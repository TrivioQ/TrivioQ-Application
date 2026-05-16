const fs = require('fs');
const path = require('path');

const enJsonPath = path.join(__dirname, 'src/i18n/en.json');
const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

function flattenObject(ob) {
  var toReturn = {};
  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;
    if (typeof ob[i] == 'object' && ob[i] !== null) {
      var flatObject = flattenObject(ob[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;
        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}

const keys = Object.keys(flattenObject(enJson));

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function (file) {
    if (fs.statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        arrayOfFiles.push(path.join(dirPath, '/', file));
      }
    }
  });
  return arrayOfFiles;
}

const allFiles = getAllFiles(path.join(__dirname, 'src'));

let combinedContent = '';
allFiles.forEach((file) => {
  combinedContent += fs.readFileSync(file, 'utf8') + '\n';
});

const unusedKeys = [];
keys.forEach((key) => {
  // Check if the key is used literally in the code
  if (!combinedContent.includes(`'${key}'`) && !combinedContent.includes(`"${key}"`) && !combinedContent.includes('`' + key + '`')) {
    // sometimes there's string interpolation but let's check basic usage first
    unusedKeys.push(key);
  }
});

console.log('Unused keys:');
console.log(unusedKeys.join('\n'));
