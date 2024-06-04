# pdf-table-extractor-ts

Extract tables from PDF

This package is based on [florpor's pdf-table-extractor](https://github.com/florpor/pdf-table-extractor) with types.

## Install

### Using npm
```bash
$ npm install --save pdf-table-extractor-ts
```

### Using yarn
```bash
$ yarn add pdf-table-extractor-ts
```

### Using pnpm
```bash
$ pnpm add pdf-table-extractor-ts
```

Once the package is installed, you can import the library using import or require approach:
```ts
import extractPdfTable from 'pdf-table-extractor-ts';
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
