# Freshersworld Jobs Scraper

Extract comprehensive job listings from Freshersworld.com - India's leading job portal for freshers and graduates. Get structured data including job titles, companies, salaries, experience requirements, and complete descriptions.

## Features

- **Comprehensive Data Extraction** - Captures all job details: title, company, location, salary, experience, qualification, skills, and full descriptions
- **Smart Filtering** - Search by keywords, location, category, experience level, and qualification
- **Structured Output** - Clean, consistent data format ready for analysis or integration
- **High Performance** - Efficient pagination and concurrent processing for fast data collection
- **Reliable Extraction** - Multiple fallback methods ensure maximum data capture

## Use Cases

- **Job Market Research** - Analyze fresher hiring trends across industries and locations
- **Salary Benchmarking** - Compare compensation packages across companies and roles
- **Recruitment Intelligence** - Monitor competitor hiring patterns and job requirements
- **Career Analytics** - Track demand for specific skills and qualifications
- **Lead Generation** - Build targeted lists of actively hiring companies

## Input Configuration

### Basic Search

| Parameter | Type | Description |
|-----------|------|-------------|
| `keyword` | String | Job title or skills to search (e.g., "Software Developer", "Data Analyst") |
| `location` | String | City filter (e.g., "Bangalore", "Mumbai", "Delhi", "Chennai") |
| `category` | String | Job category (e.g., "IT/Software", "MBA", "Core Technical") |

### Advanced Filters

| Parameter | Type | Description |
|-----------|------|-------------|
| `experience` | String | Experience level (e.g., "Freshers", "0-1 years", "1-3 years") |
| `qualification` | String | Education requirement (e.g., "B.Tech", "MCA", "MBA") |
| `startUrl` | String | Direct URL to a specific Freshersworld jobs page |

### Scraping Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `collectDetails` | Boolean | `true` | Extract full job descriptions from detail pages |
| `results_wanted` | Integer | `100` | Maximum number of jobs to collect |
| `max_pages` | Integer | `50` | Maximum search result pages to crawl |
| `proxyConfiguration` | Object | Residential | Proxy settings for reliable access |

## Example Configurations

### Search IT Jobs in Bangalore

```json
{
    "keyword": "Software Developer",
    "location": "Bangalore",
    "results_wanted": 50
}
```

### Scrape MBA Jobs Nationwide

```json
{
    "category": "MBA",
    "results_wanted": 200,
    "collectDetails": true
}
```


### Quick Listing Scan

```json
{
    "location": "Hyderabad",
    "collectDetails": false,
    "results_wanted": 500
}
```

## Output Data

Each job listing includes the following fields:

| Field | Description |
|-------|-------------|
| `title` | Job position title |
| `company` | Hiring company name |
| `location` | Job location (city/region) |
| `salary` | Salary range or CTC offered |
| `experience` | Required experience level |
| `qualification` | Required education |
| `job_type` | Employment type (Full-time, Part-time, etc.) |
| `skills` | Required skills list |
| `date_posted` | When the job was posted |
| `valid_through` | Application deadline |
| `description_html` | Complete job description (HTML) |
| `description_text` | Complete job description (plain text) |
| `apply_link` | Direct application URL |
| `url` | Link to the original job posting |

## Sample Output

```json
{
    "title": "Software Developer",
    "company": "TCS",
    "location": "Bangalore",
    "salary": "3.5 - 6 LPA",
    "experience": "Freshers",
    "qualification": "B.Tech/B.E",
    "job_type": "Full Time",
    "skills": "Java, Python, SQL, Data Structures",
    "date_posted": "2024-12-10",
    "valid_through": "2024-12-31",
    "description_text": "We are looking for talented Software Developers to join our team...",
    "url": "https://www.freshersworld.com/software-developer-jobs/1234567"
}
```

## Performance Tips

- **Use Filters** - Narrow searches with keywords and location for faster, targeted results
- **Adjust Page Limits** - Set `max_pages` based on your data needs
- **Disable Details** - Set `collectDetails: false` for quick listing scans
- **Residential Proxies** - Recommended for reliable, uninterrupted scraping

## Output Formats

Download your data in multiple formats:

- **JSON** - Structured data for applications and APIs
- **CSV** - Spreadsheet-compatible for Excel and Google Sheets
- **Excel** - Direct import into Microsoft Excel
- **XML** - Standard format for data exchange

## Integration Options

Connect scraped data directly to your workflows:

- **Webhooks** - Receive data via HTTP callbacks
- **API Access** - Programmatic data retrieval
- **Google Sheets** - Direct spreadsheet export
- **Database Sync** - Integrate with your data warehouse

## Cost Optimization

Estimate your usage based on typical performance:

| Mode | Jobs per Run | Approximate CUs |
|------|-------------|-----------------|
| With Details | 100 jobs | ~0.05 |
| Without Details | 500 jobs | ~0.02 |
| Full Category Scan | 1000 jobs | ~0.15 |

## Support

For questions, issues, or feature requests:

- Open an issue on the actor page
- Check the documentation for updates
- Review the changelog for recent improvements

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for ensuring their use complies with Freshersworld.com's terms of service and applicable data protection regulations.