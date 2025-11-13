const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = require('docx');

// Read the text files
const billText = fs.readFileSync('sample_medical_bill.txt', 'utf8');
const followupText = fs.readFileSync('sample_medical_followup.txt', 'utf8');

// Function to convert text to DOCX paragraphs
function textToDocx(text, filename) {
  const lines = text.split('\n');
  const paragraphs = lines.map(line => {
    // Detect headers (lines with ═ or all caps)
    if (line.includes('═══') || line.includes('───')) {
      return new Paragraph({
        text: '',
        spacing: { after: 100 }
      });
    }
    
    const isHeader = line.trim().length > 0 && 
                     line.trim() === line.trim().toUpperCase() && 
                     !line.includes('$') &&
                     line.trim().length < 60;
    
    if (isHeader && line.trim().length > 0) {
      return new Paragraph({
        text: line.trim(),
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 }
      });
    }
    
    // Regular text
    return new Paragraph({
      text: line,
      spacing: { after: 50 }
    });
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs
    }]
  });

  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(filename, buffer);
    console.log(`✅ Created ${filename}`);
  });
}

// Create both documents
textToDocx(billText, 'sample_medical_bill.docx');
textToDocx(followupText, 'sample_medical_followup.docx');

