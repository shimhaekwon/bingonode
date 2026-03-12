const fs = require('fs');
const pdfParse = require('pdf-parse');

const pdfFile = 'E:\\temp\\presentation.pdf';
const outputFile = 'E:\\workspace\\bingonode\\pdf_content.txt';

const dataBuffer = fs.readFileSync(pdfFile);

pdfParse.default(dataBuffer).then(function(data) {
    console.log(`Total pages: ${data.numpages}`);
    console.log(`PDF version: ${data.version}`);
    console.log(`Info: ${JSON.stringify(data.info)}`);
    
    const text = data.text;
    fs.writeFileSync(outputFile, text, 'utf-8');
    console.log(`\nSaved to: ${outputFile}`);
    console.log(`\nFirst 2000 chars:\n${text.substring(0, 2000)}`);
}).catch(err => {
    console.error('Error:', err);
});
