#!/usr/bin/env python3
"""
CFPB Complaint CSV to facts_seed.json converter
Usage: python cfpb_importer.py [--input complaints.csv] [--output facts_seed.json] [--limit 1000]
"""

import csv
import json
import argparse
from pathlib import Path


def convert_complaints_to_facts(csv_path: str, limit: int = 1000) -> list:
    """Convert CFPB complaint CSV to facts JSON array"""
    facts = []
    
    try:
        with open(csv_path, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for i, row in enumerate(reader):
                if i >= limit:
                    break
                
                # Extract relevant fields
                company = (row.get('Company') or row.get('company') or 'Unknown Company').strip()
                narrative = (row.get('Consumer complaint narrative') or 
                           row.get('consumer_complaint_narrative') or '').strip()
                state = (row.get('State') or row.get('state') or '').strip()
                product = (row.get('Product') or row.get('product') or '').strip()
                date_received = (row.get('Date received') or row.get('date_received') or '').strip()
                
                # Skip if no narrative
                if not narrative or len(narrative) < 50:
                    continue
                
                fact = {
                    'parties': {
                        'plaintiff': 'Consumer',
                        'defendant': company
                    },
                    'incident': narrative,
                    'damages': {
                        'amount_claimed': None
                    },
                    'venue': state,
                    'category': product,
                    'incident_date': date_received
                }
                
                facts.append(fact)
        
        print(f"Converted {len(facts)} complaints to facts JSON")
        return facts
        
    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_path}")
        print("\nTo get CFPB data:")
        print("1. Visit https://www.consumerfinance.gov/data-research/consumer-complaints/")
        print("2. Click 'Export data' and download CSV with complaint narratives")
        print("3. Save as data/complaints.csv")
        return []
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(description='Convert CFPB complaints CSV to facts JSON')
    parser.add_argument('--input', default='data/complaints.csv', help='Input CSV file path')
    parser.add_argument('--output', default='data/facts_seed.json', help='Output JSON file path')
    parser.add_argument('--limit', type=int, default=1000, help='Maximum number of records to process')
    
    args = parser.parse_args()
    
    # Ensure data directory exists
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    
    # Convert
    facts = convert_complaints_to_facts(args.input, args.limit)
    
    if not facts:
        print("\nNo facts generated. Please check your input file.")
        return
    
    # Write output
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(facts, f, indent=2, ensure_ascii=False)
    
    print(f"\nWrote {len(facts)} facts to {args.output}")
    print("First fact preview:")
    print(json.dumps(facts[0], indent=2)[:500] + "...")


if __name__ == '__main__':
    main()

