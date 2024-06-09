# 🐸 PDF Table Parser

Simplified parsing of tables from PDF

## ❔ Why?

**PDF Table Parser** is a library based on [florpor's pdf-table-extractor](https://github.com/florpor/pdf-table-extractor) with **built-in types**. I couldn't find any ready-made library for parsing tables from pdf, so I rewrote the source code of the library to modern **TypeScript**, output all types and slightly changed it.

## 🚀 Install

### Using npm
```bash
npm install --save @mkas3/pdf-table-parser
```

### Using yarn
```bash
yarn add @mkas3/pdf-table-parser
```

### Using pnpm
```bash
pnpm add @mkas3/pdf-table-parser
```

Once the package is installed, you can import the library using import or require approach:
```ts
import { extractPdfTable } from '@mkas3/pdf-table-parser';
```

## Example

### Example
```ts
import fs from 'fs';
import extractPdfTable from 'pdf-table-extractor-ts';

const file = fs.readFileSync('example.pdf');

extractPdfTable(file).then(res => {
  console.log(JSON.stringify(res));
});
```

## API

#### extractPdfTable(buffer, options)
- `buffer` <[ArrayBuffer]> pdf file buffer.
- `options` <[Object]>
  - `maxEdgesPerPage` <?[number]> maximum number of edges to process per page. if defined and number of identified edges surpasses the setting tables will not be processes for the current page.
  - `progressFunc` <?[function(Object)]> callback to call after each page is processes with the current result object.
- returns: <[Promise]<[Object]>>

## License
BSD License
