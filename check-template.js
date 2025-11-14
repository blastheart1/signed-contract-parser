const XLSX = require('xlsx');

const workbook = XLSX.readFile('./contract-parser/template.xlsx');
const worksheet = workbook.Sheets['Order Items'] || workbook.Sheets[workbook.SheetNames[0]];

// Get the range
const range = XLSX.utils.decode_range(worksheet['!ref']);

console.log('Checking all rows, especially headers and row 15 onwards:\n');

// Check all merge ranges
const mergedCells = worksheet['!merges'] || [];
console.log('All merged ranges in the file:');
mergedCells.forEach(m => {
  console.log(`  ${XLSX.utils.encode_cell(m.s)}:${XLSX.utils.encode_cell(m.e)} (Row ${m.s.r + 1} to ${m.e.r + 1}, Col ${m.s.c + 1} to ${m.e.c + 1})`);
});
console.log('');

// Check header rows first (1-15 to see where headers start)
console.log('Checking rows 1-16 for header structure:\n');
for (let rowNum = 0; rowNum <= 15; rowNum++) {
  const cellA = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 0 })];
  const cellB = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 1 })];
  const cellC = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 2 })];
  const cellD = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 3 })];
  const cellE = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })];
  
  const mergedWithD = mergedCells.find(m => 
    m.s.r <= rowNum && m.e.r >= rowNum &&
    m.s.c <= 3 && m.e.c >= 4
  );
  
  // Show all rows 1-16 to understand structure
  console.log(`Row ${rowNum + 1}:`);
  console.log(`  A: "${cellA?.v || '(empty)'}"`);
  console.log(`  B: "${cellB?.v || '(empty)'}"`);
  console.log(`  C: "${cellC?.v || '(empty)'}"`);
  console.log(`  D: "${cellD?.v || '(empty)'}"`);
  console.log(`  E: "${cellE?.v || '(empty)'}"`);
  if (mergedWithD) {
    console.log(`  ✓ Merged D:E (${XLSX.utils.encode_cell(mergedWithD.s)}:${XLSX.utils.encode_cell(mergedWithD.e)})`);
  }
  console.log('');
}

console.log('Checking rows 15 onwards, columns D and E:\n');

for (let rowNum = 14; rowNum <= Math.min(range.e.r, 30); rowNum++) { // Start from row 15 (0-indexed is 14)
  const cellD = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 3 })]; // Column D is index 3
  const cellE = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: 4 })]; // Column E is index 4
  
  // Check if cells are merged
  const mergedCells = worksheet['!merges'] || [];
  const isDMerged = mergedCells.some(m => 
    m.s.r === rowNum && m.s.c === 3 && 
    (m.e.c > 3 || (m.e.c === 3 && m.e.r === rowNum))
  );
  const isEMerged = mergedCells.some(m => 
    m.s.r === rowNum && m.s.c === 4 && 
    m.s.c <= 3 && m.e.c >= 4
  );
  
  console.log(`Row ${rowNum + 1}:`);
  console.log(`  Cell D (${XLSX.utils.encode_cell({ r: rowNum, c: 3 })}):`, cellD?.v || '(empty)', 
              cellD?.s ? `| Style: ${JSON.stringify(cellD.s)}` : '');
  console.log(`  Cell E (${XLSX.utils.encode_cell({ r: rowNum, c: 4 })}):`, cellE?.v || '(empty)',
              cellE?.s ? `| Style: ${JSON.stringify(cellE.s)}` : '');
  
  // Check for merged range
  const mergedWithD = mergedCells.find(m => 
    m.s.r <= rowNum && m.e.r >= rowNum &&
    m.s.c <= 3 && m.e.c >= 3
  );
  if (mergedWithD) {
    console.log(`  Merged range: ${XLSX.utils.encode_cell(mergedWithD.s)}:${XLSX.utils.encode_cell(mergedWithD.e)}`);
  }
  console.log('');
}

// Check column count
console.log('Total columns:', range.e.c + 1);
console.log('Column definitions:', worksheet['!cols']);

