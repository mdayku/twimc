/**
 * Simple script to create a sample incident report PDF
 * Run: node create_sample_pdf.js
 */

const fs = require('fs');
const { Document, Packer, Paragraph, TextRun } = require('docx');

const content = fs.readFileSync('sample_incident_report.txt', 'utf-8');

const doc = new Document({
  sections: [{
    properties: {},
    children: content.split('\n\n').map(paragraph => 
      new Paragraph({
        children: [new TextRun(paragraph)],
        spacing: { after: 200 }
      })
    )
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('sample_incident_report.docx', buffer);
  console.log('✅ Created sample_incident_report.docx');
  console.log('📄 You can now upload this file to your app at /new');
});

