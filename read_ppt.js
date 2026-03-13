const fs = require('fs');
const path = require('path');

// Try to use pptx-parser
let pptxParser;
try {
    pptxParser = require('pptx-parser');
} catch (e) {
    console.error('pptx-parser not found');
    process.exit(1);
}

const pptxFilePath = "e:\\프로젝트\\오뚜기몰\\사전작업\\제안서 1.0\\오뚜기몰 리뉴얼 프로젝트 제안요약서_V1.0.pptx";

if (!fs.existsSync(pptxFilePath)) {
    console.error('File not found:', pptxFilePath);
    process.exit(1);
}

try {
    const parser = new pptxParser();
    const data = parser.parse(pptxFilePath);
    
    console.log('=== PPTX Content ===');
    console.log(JSON.stringify(data, null, 2));
} catch (e) {
    console.error('Error:', e.message);
}
