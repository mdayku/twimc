# Data Provenance and Licenses

This document tracks the sources and licenses for all data used in this project.

## CFPB Consumer Complaint Database

**Source**: Consumer Financial Protection Bureau (CFPB)  
**URL**: https://www.consumerfinance.gov/data-research/consumer-complaints/  
**API**: https://cfpb.github.io/api/ccdb/  

**License**: Public Domain (U.S. Government Work)

The Consumer Complaint Database is a collection of complaints about consumer financial products and services that we sent to companies for response. Complaints are published after the company responds, confirming a commercial relationship with the consumer, or after 15 days, whichever comes first.

**Usage Notes**:
- Data is anonymized by CFPB before publication
- Personally Identifiable Information (PII) has been removed
- This project uses complaint narratives only for generating synthetic test cases
- No actual consumer data is stored in production

## Public Legal Templates

**Sources**:
- California Courts Self-Help Center: https://www.courts.ca.gov/selfhelp.htm
- Massachusetts Office of Consumer Affairs and Business Regulation
- General public legal education resources

**Usage**: Structure and format guidance only. No proprietary firm templates are used.

## Synthetic Data

All `facts_seed.json` examples are either:
1. Synthesized from anonymized CFPB narratives (further modified)
2. Completely fictional scenarios created for testing

No real case data or client information is included.

## Privacy Commitment

- All data used complies with applicable privacy laws
- No attorney-client privileged information
- No real PII in training or test data
- Production system will include PII redaction in logs

