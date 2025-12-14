// Freshersworld Jobs Scraper - Production-grade CheerioCrawler implementation
import { Actor, log } from 'apify';
import { CheerioCrawler, Dataset } from 'crawlee';
import { load as cheerioLoad } from 'cheerio';

await Actor.init();

async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            keyword = '',
            location = '',
            category = '',
            experience = '',
            qualification = '',
            results_wanted: RESULTS_WANTED_RAW = 100,
            max_pages: MAX_PAGES_RAW = 50,
            collectDetails = true,
            startUrl,
            url,
            proxyConfiguration,
        } = input;

        const RESULTS_WANTED = Number.isFinite(+RESULTS_WANTED_RAW) ? Math.max(1, +RESULTS_WANTED_RAW) : Number.MAX_SAFE_INTEGER;
        const MAX_PAGES = Number.isFinite(+MAX_PAGES_RAW) ? Math.max(1, +MAX_PAGES_RAW) : 50;
        const BASE_URL = 'https://www.freshersworld.com';
        const JOBS_PER_PAGE = 20;

        // User-Agent rotation for stealth
        const USER_AGENTS = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        ];
        const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

        // Convert relative URLs to absolute
        const toAbs = (href, base = BASE_URL) => {
            if (!href) return null;
            try { return new URL(href, base).href; } catch { return null; }
        };

        // Clean HTML to plain text
        const cleanText = (html) => {
            if (!html) return '';
            const $ = cheerioLoad(html);
            $('script, style, noscript, iframe, nav, footer, header').remove();
            return $.root().text().replace(/\s+/g, ' ').trim();
        };

        // Sanitize HTML - keep only text-related tags
        const sanitizeHtml = (html) => {
            if (!html) return '';
            const $ = cheerioLoad(html);

            // Remove unwanted elements
            $(
                'script, style, noscript, iframe, img, svg, video, audio, ' +
                'nav, footer, header, form, input, button, select, textarea, ' +
                '.navbar, .menu, .sidebar, .header, .footer, ' +
                '.advertisement, .ad, [class*="ad-"], [id*="ad-"], ' +
                '.social, .share, .comment, .related, ' +
                '[onclick], [onload], [onerror]'
            ).remove();

            // Remove event attributes
            $('*').each((_, el) => {
                const $el = $(el);
                const attrs = el.attribs || {};
                Object.keys(attrs).forEach(attr => {
                    if (attr.startsWith('on') || attr === 'style' || attr === 'class' || attr === 'id') {
                        $el.removeAttr(attr);
                    }
                });
            });

            // Get clean HTML
            let cleaned = $.html().trim();

            // Remove excessive whitespace
            cleaned = cleaned.replace(/\s+/g, ' ').replace(/>\s+</g, '><');

            return cleaned;
        };

        // Build Freshersworld search URL
        const buildStartUrl = (kw, loc, cat, exp, qual) => {
            // Freshersworld uses category-based URLs for job listings:
            // - /jobs/category/it-software-job-vacancies
            // - /jobs-in-bangalore (for location)
            // - /jobs (general listing)

            // Map keywords to category URLs
            if (kw) {
                const kwLower = String(kw).trim().toLowerCase();

                // Map keywords to category slugs
                const keywordCategoryMap = {
                    'software': 'it-software',
                    'it': 'it-software',
                    'developer': 'it-software',
                    'engineer': 'it-software',
                    'tech': 'it-software',
                    'java': 'it-software',
                    'python': 'it-software',
                    'analyst': 'it-software',
                    'mba': 'mba',
                    'admin': 'others',
                    'bpo': 'bpo',
                    'core': 'core-technical',
                    'mechanical': 'core-technical',
                    'electrical': 'core-technical',
                    'civil': 'core-technical',
                    'internship': 'internship',
                    'intern': 'internship',
                    'diploma': 'diploma',
                    'teaching': 'teaching',
                    'pharma': 'pharma',
                    'bank': 'bank',
                    'walkin': 'walkin',
                    'walk-in': 'walkin',
                    'part time': 'part-time',
                    'health': 'health-care',
                    'retail': 'retail',
                    'hr': 'mba',
                    'marketing': 'mba',
                    'sales': 'mba',
                    'finance': 'finance',
                    'startup': 'startup',
                };

                // Find matching category
                for (const [key, catSlug] of Object.entries(keywordCategoryMap)) {
                    if (kwLower.includes(key)) {
                        return `${BASE_URL}/jobs/category/${catSlug}-job-vacancies`;
                    }
                }

                // Default to IT/Software for unknown keywords
                return `${BASE_URL}/jobs/category/it-software-job-vacancies`;
            }

            // If location provided, use location-based URL
            if (loc) {
                const locSlug = String(loc).trim().toLowerCase().replace(/\s+/g, '-');
                return `${BASE_URL}/jobs-in-${locSlug}`;
            }

            // If category provided
            if (cat) {
                const catSlug = String(cat).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                return `${BASE_URL}/jobs/category/${catSlug}-job-vacancies`;
            }

            // Default: general jobs listing (but this won't have individual job links)
            // Instead, default to IT/Software which does have job links
            return `${BASE_URL}/jobs/category/it-software-job-vacancies`;
        };

        // Build paginated URL
        const buildPaginatedUrl = (baseUrl, pageNo) => {
            const u = new URL(baseUrl);
            const offset = (pageNo - 1) * JOBS_PER_PAGE;
            u.searchParams.set('limit', String(JOBS_PER_PAGE));
            u.searchParams.set('offset', String(offset));
            return u.href;
        };

        const initial = [];
        if (startUrl) initial.push(startUrl);
        if (url) initial.push(url);
        if (!initial.length) initial.push(buildStartUrl(keyword, location, category, experience, qualification));

        const proxyConf = proxyConfiguration ? await Actor.createProxyConfiguration({ ...proxyConfiguration }) : undefined;

        let saved = 0;
        const seenUrls = new Set();

        // Extract JobPosting from JSON-LD
        function extractFromJsonLd($) {
            const scripts = $('script[type="application/ld+json"]');
            for (let i = 0; i < scripts.length; i++) {
                try {
                    const raw = $(scripts[i]).html() || '';
                    const parsed = JSON.parse(raw);
                    const arr = Array.isArray(parsed) ? parsed : [parsed];

                    for (const e of arr) {
                        if (!e) continue;
                        const t = e['@type'] || e.type;
                        if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) {
                            const hiringOrg = e.hiringOrganization || {};
                            const jobLoc = e.jobLocation || {};
                            const address = jobLoc.address || {};
                            const salary = e.baseSalary || {};
                            const salaryValue = salary.value || {};

                            let salaryText = '';
                            if (salaryValue.minValue && salaryValue.maxValue) {
                                salaryText = `${salaryValue.minValue} - ${salaryValue.maxValue} ${salary.currency || 'INR'}`;
                            } else if (salaryValue.value) {
                                salaryText = `${salaryValue.value} ${salary.currency || 'INR'}`;
                            } else if (typeof salary === 'string') {
                                salaryText = salary;
                            }

                            return {
                                title: e.title || e.name || '',
                                company: hiringOrg.name || '',
                                company_logo: hiringOrg.logo || '',
                                location: address.addressLocality || address.addressRegion ||
                                    (typeof jobLoc === 'string' ? jobLoc : '') || '',
                                date_posted: e.datePosted || '',
                                valid_through: e.validThrough || '',
                                description_html: e.description || '',
                                salary: salaryText,
                                employment_type: Array.isArray(e.employmentType) ? e.employmentType.join(', ') : (e.employmentType || ''),
                                experience: e.experienceRequirements?.monthsOfExperience ?
                                    `${Math.floor(e.experienceRequirements.monthsOfExperience / 12)} years` : '',
                                qualification: e.educationRequirements?.credentialCategory || '',
                                skills: Array.isArray(e.skills) ? e.skills.join(', ') : (e.skills || ''),
                                industry: e.industry || '',
                                apply_link: e.url || '',
                            };
                        }
                    }
                } catch (err) { /* ignore parsing errors */ }
            }
            return null;
        }

        // Find job listing links on list pages
        function findJobLinks($, base) {
            const links = new Set();

            // Freshersworld job detail URLs have multiple patterns:
            // Pattern 1: /jobs/[slug]-[7-digit-id] (e.g., /jobs/software-developer-opening-2797103)
            // Pattern 2: /[keyword]-jobs/[10-digit-id] (e.g., /admin-jobs/3535115278)

            // Helper to validate job URL - STRICT pattern matching
            const isJobDetailUrl = (href) => {
                if (!href) return false;

                // MUST explicitly exclude location listing pages
                // Pattern: /jobs-in-{location}/{id} - these are listing pages, NOT job detail pages!
                if (/\/jobs-in-[a-z-]+\/\d+$/i.test(href)) {
                    return false;
                }

                // Exclude other non-job pages
                if (href.includes('/category/') ||
                    href.includes('/training-') ||
                    href.includes('/institute') ||
                    href.includes('/placement') ||
                    href.includes('/user/') ||
                    href.includes('/contactus') ||
                    href.includes('/about-us') ||
                    href.includes('/premium') ||
                    href.includes('-job-vacancies') ||
                    href.includes('/jobs-by-')) {
                    return false;
                }

                // ONLY match actual job detail URLs:
                // Pattern: /jobs/[descriptive-slug-containing-jobs-opening-in]-[6-7 digit ID]
                // Example: /jobs/software-developer-jobs-opening-in-company-at-location-2797103
                // The slug typically contains "jobs-opening-in" or similar pattern
                if (/\/jobs\/[a-z0-9-]+-\d{6,8}$/i.test(href)) {
                    return true;
                }

                return false;
            };

            $('a[href]').each((_, a) => {
                const href = $(a).attr('href');
                if (isJobDetailUrl(href)) {
                    const abs = toAbs(href, base);
                    if (abs) links.add(abs);
                }
            });

            // Also check for specific job listing selectors
            $('.job-container a, .job-card a, .job-listing a, .jobs-list a, [class*="job-item"] a, a.view, .view-more a').each((_, a) => {
                const href = $(a).attr('href');
                if (isJobDetailUrl(href)) {
                    const abs = toAbs(href, base);
                    if (abs) links.add(abs);
                }
            });

            return [...links];
        }

        // Extract job data from listing card (minimal info for non-detail mode)
        function extractFromListingCard($, el) {
            const $el = $(el);
            return {
                title: $el.find('h2, h3, .job-title, [class*="title"]').first().text().trim() || '',
                company: $el.find('.company-name, [class*="company"], .employer').first().text().trim() || '',
                location: $el.find('.location, [class*="location"], .job-location').first().text().trim() || '',
                salary: $el.find('.salary, [class*="salary"]').first().text().trim() || '',
            };
        }

        // Extract job data from detail page HTML
        function extractFromDetailHtml($) {
            const data = {};

            // Remove unwanted elements first
            $('header, nav, footer, .header, .footer, .navbar, .menu, .sidebar, script, style').remove();

            // Title - Look for job title specifically
            let titleSelectors = [
                '.seo_title',
                '.wrap-title.seo_title',
                '.job-new-title .wrap-title',
                'h1.job-title',
                'h1'
            ];
            for (const sel of titleSelectors) {
                // Remove More/Less spans first
                const titleEl = $(sel).first().clone();
                titleEl.find('.title_more, .title_less, span[style*="display:none"]').remove();

                let title = titleEl.text().trim();
                if (title && title.length > 5 && !title.includes('Login') && !title.includes('Employer')) {
                    // Clean common unwanted text patterns
                    title = title
                        .replace(/Less$/i, '')
                        .replace(/More$/i, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    data.title = title;
                    break;
                }
            }

            // Company - Very specific selector
            let company = $('.latest-jobs-title.company-name').first().text().trim();
            if (!company || company.includes('Login') || company.includes('Employer')) {
                company = $('h3.company-name').first().text().trim();
            }
            if (!company || company.includes('Login') || company.includes('Employer')) {
                company = $('.company-name').not(':has(a)').first().text().trim();
            }
            // Filter out login/employer text
            if (company && !company.includes('Login') && !company.includes('Employer') && !company.includes('Institute')) {
                data.company = company;
            } else {
                data.company = '';
            }

            // Location
            const locationText = $('.job-location a.bold_font').first().text().trim() ||
                $('.job-location').first().text().trim() ||
                $('a.bold_font[href*="jobs-in-"]').first().text().trim();
            data.location = locationText;

            // Experience - Look for .experience.job-details-span
            let expText = $('.experience.job-details-span').first().text().trim();
            if (!expText) {
                expText = $('span.experience').first().text().trim();
            }
            data.experience = expText;

            // Salary and Qualification - These are in .qualifications spans
            // First .qualifications block is salary, second is qualification
            const qualBlocks = $('.qualifications.display-block').toArray();

            if (qualBlocks.length > 0) {
                // First one is usually salary
                const firstBlock = $(qualBlocks[0]).text().trim();
                // Check if it looks like salary (contains numbers)
                if (/\d/.test(firstBlock)) {
                    data.salary = firstBlock;
                }

                // Second block is usually qualification
                if (qualBlocks.length > 1) {
                    const qualBlock = $(qualBlocks[1]);
                    const quals = [];
                    qualBlock.find('.bold_elig, .elig_pos').each((_, el) => {
                        const q = $(el).text().trim();
                        if (q && q.length < 50) quals.push(q);
                    });
                    if (quals.length > 0) {
                        data.qualification = quals.join(', ');
                    } else {
                        data.qualification = qualBlock.text().trim();
                    }
                }
            }

            // If salary not found, try alternative selectors
            if (!data.salary) {
                data.salary = $('.salary-range, [class*="salary"], .ctc').first().text().trim();
            }

            // If qualification not found in blocks, try other selectors
            if (!data.qualification) {
                data.qualification = $('.qualification, [class*="qualification"], [class*="eligib"]').first().text().trim();
            }

            // Job Type - Look for job type related text, avoid capturing everything
            let jobTypeText = '';
            const jobTypes = ['Full Time', 'Part Time', 'Contract', 'Internship', 'Remote', 'Freelance', 'Temporary', 'Walk-in'];

            // First try specific selectors
            const jobTypeEl = $('.job-type, [class*="job-type"], [class*="employment-type"]').first();
            if (jobTypeEl.length) {
                const rawType = jobTypeEl.text().trim();
                // Check if it contains one of the known job types
                for (const type of jobTypes) {
                    if (rawType.toLowerCase().includes(type.toLowerCase())) {
                        jobTypeText = type;
                        break;
                    }
                }
            }

            // If not found, search in page text
            if (!jobTypeText) {
                const pageText = $('body').text();
                for (const type of jobTypes) {
                    if (pageText.includes(type) || pageText.toLowerCase().includes(type.toLowerCase())) {
                        jobTypeText = type;
                        break;
                    }
                }
            }
            data.job_type = jobTypeText;

            // Skills - Look for skill tags or key skills section (avoid long text)
            const skills = new Set();
            $('.skills-tag, .skill-item, .key-skill, .skill-badge').each((_, el) => {
                const skill = $(el).text().trim();
                // Only add if it looks like a skill (short, no sentences)
                if (skill && skill.length < 40 && skill.length > 1 && !skill.includes('\n') && !/[.!?]/.test(skill)) {
                    skills.add(skill);
                }
            });
            data.skills = skills.size > 0 ? [...skills].join(', ') : '';

            // Posted Date - Can be in various formats
            let postedDate = $('.posted-date, .date-posted, time, [class*="posted"]').first().text().trim();
            if (!postedDate) {
                // Try to extract from text like "Posted: 2 days ago"
                const pageText = $.text();
                const dateMatch = pageText.match(/Posted[:\s]+([^<>\n]+)/i);
                if (dateMatch) {
                    postedDate = dateMatch[1].trim();
                }
            }
            data.date_posted = postedDate;

            // Description - Look for actual job description content
            // Remove all the layout containers first
            $('.job_listing_alignment, .col-md-12, .col-xs-12, .col-lg-12').find('header, nav, .menu, .navbar').remove();

            let descHtml = '';
            const descSelectors = [
                '.job-description',
                '#job-description',
                '.job-desc',
                '.job-content',
                '.desc',
                '[class*="description"]'
            ];

            for (const sel of descSelectors) {
                const el = $(sel).first();
                if (el.length) {
                    const html = el.html();
                    const text = el.text().trim();
                    // Must have substantial content and not be the whole page
                    if (text.length > 50 && text.length < 10000) {
                        descHtml = html;
                        break;
                    }
                }
            }

            // If still not found, look for content after job details
            if (!descHtml) {
                // Try to find paragraph tags with actual content
                $('p, div.desc').each((_, el) => {
                    const text = $(el).text().trim();
                    if (text.length > 100 && !text.includes('Login') && !text.includes('Register')) {
                        descHtml = $(el).html();
                        return false;
                    }
                });
            }

            if (descHtml) {
                data.description_html = sanitizeHtml(descHtml);
            } else {
                data.description_html = '';
            }

            // Industry
            data.industry = $('.industry, [class*="industry"]').first().text().trim();

            // Apply link
            let applyLink = $('a.apply-btn, a[class*="apply"], button[class*="apply"]').first().attr('href') ||
                $('a:contains("Apply Now")').first().attr('href') || '';
            if (applyLink) {
                applyLink = toAbs(applyLink) || applyLink;
            }
            data.apply_link = applyLink;

            // Company logo - multiple selectors
            let companyLogo = '';
            const logoSelectors = [
                'img.company-logo',
                'img[class*="company-logo"]',
                '.company-logo img',
                '.logo img',
                'img[alt*="company"]',
                'img[alt*="logo"]',
                '.company-info img',
                '.job-company img'
            ];
            for (const sel of logoSelectors) {
                const logo = $(sel).first().attr('src');
                if (logo && logo.length > 5) {
                    companyLogo = toAbs(logo) || logo;
                    break;
                }
            }
            data.company_logo = companyLogo;

            // Valid through / deadline
            data.valid_through = $('.deadline, .last-date, [class*="deadline"]').first().text().trim();

            return data;
        }

        // Check if next page exists
        function findNextPageInfo($, currentPage, baseUrl) {
            // Look for next page link or pagination
            const nextLink = $('a.next, a[rel="next"], a:contains("Next"), .pagination a:contains(">"), .pagination a:contains("»")').first().attr('href');
            if (nextLink) {
                return { hasNext: true, nextUrl: toAbs(nextLink) };
            }

            // Check if current page number exists in pagination
            const pageNumbers = [];
            $('.pagination a, .page-numbers a, [class*="pagination"] a').each((_, a) => {
                const text = $(a).text().trim();
                const num = parseInt(text, 10);
                if (!isNaN(num)) pageNumbers.push(num);
            });

            if (pageNumbers.length && Math.max(...pageNumbers) > currentPage) {
                return { hasNext: true, nextUrl: buildPaginatedUrl(baseUrl.split('?')[0], currentPage + 1) };
            }

            // Check for offset-based pagination
            const hasMoreJobs = findJobLinks($, baseUrl).length >= JOBS_PER_PAGE * 0.5;
            if (hasMoreJobs) {
                return { hasNext: true, nextUrl: buildPaginatedUrl(baseUrl.split('?')[0], currentPage + 1) };
            }

            return { hasNext: false, nextUrl: null };
        }

        const crawler = new CheerioCrawler({
            proxyConfiguration: proxyConf,
            maxRequestRetries: 3,
            useSessionPool: true,
            persistCookiesPerSession: true,
            maxConcurrency: 15,  // Increased for speed
            requestHandlerTimeoutSecs: 45,  // Reduced for faster failover
            additionalMimeTypes: ['application/json'],

            // Stealth: Add random headers to each request
            preNavigationHooks: [
                async ({ request }) => {
                    request.headers = {
                        ...request.headers,
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Referer': 'https://www.freshersworld.com/',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'same-origin',
                        'Cache-Control': 'max-age=0',
                    };
                }
            ],

            async requestHandler({ request, $, enqueueLinks, log: crawlerLog }) {
                const label = request.userData?.label || 'LIST';
                const pageNo = request.userData?.pageNo || 1;
                const baseSearchUrl = request.userData?.baseSearchUrl || request.url.split('?')[0];

                if (label === 'LIST') {
                    const links = findJobLinks($, request.url);
                    crawlerLog.info(`[LIST] Page ${pageNo}: ${request.url} → found ${links.length} job links`);

                    // Filter out already seen URLs
                    const newLinks = links.filter(l => !seenUrls.has(l));
                    newLinks.forEach(l => seenUrls.add(l));

                    if (collectDetails) {
                        const remaining = RESULTS_WANTED - saved;
                        const toEnqueue = newLinks.slice(0, Math.max(0, remaining));
                        if (toEnqueue.length) {
                            await enqueueLinks({
                                urls: toEnqueue,
                                userData: { label: 'DETAIL' }
                            });
                            crawlerLog.info(`[LIST] Enqueued ${toEnqueue.length} detail pages`);
                        }
                    } else {
                        // Non-detail mode - extract basic info from listing cards
                        const remaining = RESULTS_WANTED - saved;
                        const jobCards = $('.job-container, .job-card, .job-listing, [class*="job-item"]').toArray();
                        const items = [];

                        for (let i = 0; i < Math.min(jobCards.length, remaining); i++) {
                            const cardData = extractFromListingCard($, jobCards[i]);
                            if (cardData.title) {
                                items.push({
                                    ...cardData,
                                    url: newLinks[i] || '',
                                    _source: 'freshersworld.com',
                                });
                            }
                        }

                        if (items.length) {
                            await Dataset.pushData(items);
                            saved += items.length;
                            crawlerLog.info(`[LIST] Saved ${items.length} items (total: ${saved})`);
                        }
                    }

                    // Handle pagination
                    if (saved < RESULTS_WANTED && pageNo < MAX_PAGES && newLinks.length > 0) {
                        const { hasNext, nextUrl } = findNextPageInfo($, pageNo, baseSearchUrl);
                        if (hasNext && nextUrl && !seenUrls.has(nextUrl)) {
                            seenUrls.add(nextUrl);
                            await enqueueLinks({
                                urls: [nextUrl],
                                userData: {
                                    label: 'LIST',
                                    pageNo: pageNo + 1,
                                    baseSearchUrl
                                }
                            });
                            crawlerLog.info(`[LIST] Enqueued next page: ${pageNo + 1}`);
                        }
                    }
                    return;
                }

                if (label === 'DETAIL') {
                    if (saved >= RESULTS_WANTED) {
                        crawlerLog.info(`[DETAIL] Skipping - results limit reached`);
                        return;
                    }

                    try {
                        // Try JSON-LD first (most reliable)
                        let data = extractFromJsonLd($) || {};

                        // Enrich with HTML parsing
                        const htmlData = extractFromDetailHtml($);

                        // Merge data - prefer JSON-LD but fill gaps from HTML
                        const merged = {
                            title: data.title || htmlData.title || '',
                            company: data.company || htmlData.company || '',
                            company_logo: data.company_logo || htmlData.company_logo || '',
                            location: data.location || htmlData.location || '',
                            salary: data.salary || htmlData.salary || '',
                            experience: data.experience || htmlData.experience || '',
                            qualification: data.qualification || htmlData.qualification || '',
                            job_type: data.employment_type || htmlData.job_type || '',
                            skills: data.skills || htmlData.skills || '',
                            industry: data.industry || htmlData.industry || '',
                            date_posted: data.date_posted || htmlData.date_posted || '',
                            valid_through: data.valid_through || htmlData.valid_through || '',
                            description_html: data.description_html || htmlData.description_html || '',
                            description_text: '',
                            apply_link: data.apply_link || htmlData.apply_link || request.url,
                            url: request.url,
                        };

                        // Generate plain text description
                        if (merged.description_html) {
                            merged.description_text = cleanText(merged.description_html);
                        }

                        // Validate - must have at least title
                        if (!merged.title) {
                            crawlerLog.warning(`[DETAIL] No title found for ${request.url}`);
                            return;
                        }

                        await Dataset.pushData(merged);
                        saved++;
                        crawlerLog.info(`[DETAIL] Saved: "${merged.title}" at ${merged.company} (total: ${saved})`);

                    } catch (err) {
                        crawlerLog.error(`[DETAIL] Failed ${request.url}: ${err.message}`);
                    }
                }
            },

            async failedRequestHandler({ request, log: crawlerLog }, error) {
                crawlerLog.error(`Request failed after retries: ${request.url} - ${error.message}`);
            },
        });

        log.info(`Starting Freshersworld scraper with ${initial.length} initial URL(s)`);
        log.info(`Target: ${RESULTS_WANTED} results, max ${MAX_PAGES} pages`);

        await crawler.run(initial.map(u => ({
            url: u,
            userData: {
                label: 'LIST',
                pageNo: 1,
                baseSearchUrl: u.split('?')[0]
            }
        })));

        log.info(`✓ Finished! Saved ${saved} job listings`);

    } finally {
        await Actor.exit();
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
