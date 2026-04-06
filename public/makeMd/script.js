document.getElementById('convertBtn').addEventListener('click', () => {
    const input = document.getElementById('inputArea').value.trim();
    if (!input) {
        alert('Please paste some data first!');
        return;
    }

    const lines = input.split(/\r?\n/);
    if (lines.length === 0) return;

    const rows = lines.map(line => line.split('\t'));
    
    if (rows.length === 0) return;

    let mdTable = '';
    
    // Header
    mdTable += '| ' + rows[0].join(' | ') + ' |\n';
    
    // Separator
    mdTable += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n';
    
    // Data rows
    for (let i = 1; i < rows.length; i++) {
        mdTable += '| ' + rows[i].join(' | ') + ' |\n';
    }

    document.getElementById('outputArea').value = mdTable;

    // Show preview
    const previewContainer = document.getElementById('previewContainer');
    const previewArea = document.getElementById('previewArea');
    
    if (previewContainer && previewArea && typeof marked !== 'undefined') {
        previewContainer.classList.remove('hidden');
        previewArea.innerHTML = marked.parse(mdTable);
    }
});

document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('inputArea').value = '';
    document.getElementById('outputArea').value = '';
    const previewContainer = document.getElementById('previewContainer');
    if (previewContainer) {
        previewContainer.classList.add('hidden');
    }
});

document.getElementById('copyBtn').addEventListener('click', () => {
    const output = document.getElementById('outputArea');
    if (!output.value) return;
    
    output.select();
    document.execCommand('copy');
    alert('Copied to clipboard!');
});
