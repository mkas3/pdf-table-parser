import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getDocument, OPS } from 'pdfjs-dist';
import type { PDFOperatorList, TextContent } from 'pdfjs-dist/types/src/display/api';

const xmlEncode = (str: string) => {
  let i = 0;
  let ch: string;
  const newStr = String(str);
  while (i < newStr.length) {
    ch = newStr[i];
    if (ch !== '&' && ch !== '<' && ch !== '"' && ch !== '\n' && ch !== '\r' && ch !== '\t') break;
    i += 1;
  }
  if (i >= newStr.length) {
    return newStr;
  }
  let buf = newStr.substring(0, i);
  while (i < newStr.length) {
    i += 1;
    ch = newStr[i];
    switch (ch) {
      case '&':
        buf += '&amp;';
        break;
      case '<':
        buf += '&lt;';
        break;
      case '"':
        buf += '&quot;';
        break;
      case '\n':
        buf += '&#xA;';
        break;
      case '\r':
        buf += '&#xD;';
        break;
      case '\t':
        buf += '&#x9;';
        break;
      default:
        buf += ch;
        break;
    }
  }
  return buf;
};

declare const global: {
  btoa: (chars: string) => void;
  document: {
    head?: HTMLHeadElement | DOMElement;
    childNodes: ChildNode[];
    currentScript: { src: string };
    documentElement: typeof global.document;
    createElementNS: (_: unknown, element: string) => DOMElement;
    createElement: (element: string) => DOMElement;
    getElementsByTagName: (element: string) => unknown;
  };
};

global.btoa = function btoa(chars: string) {
  const digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let buffer = '';
  let i: number;
  let n: number;
  for (i = 0, n = chars.length; i < n; i += 3) {
    const b1 = chars.charCodeAt(i) & 0xff;
    const b2 = chars.charCodeAt(i + 1) & 0xff;
    const b3 = chars.charCodeAt(i + 2) & 0xff;
    const d1 = b1 >> 2;
    const d2 = ((b1 & 3) << 4) | (b2 >> 4);
    const d3 = i + 1 < n ? ((b2 & 0xf) << 2) | (b3 >> 6) : 64;
    const d4 = i + 2 < n ? b3 & 0x3f : 64;
    buffer += digits.charAt(d1) + digits.charAt(d2) + digits.charAt(d3) + digits.charAt(d4);
  }
  return buffer;
};

class DOMElement {
  nodeName: string = '';

  childNodes: unknown[] = [];

  attributes: Record<string, string> = {};

  textContent: string = '';

  parentNode?: DOMElement;

  sheet: {
    cssRules?: string[];
    insertRule?: (rule: string) => void;
  } = {};

  constructor(elementName: string) {
    this.nodeName = elementName;
    this.childNodes = [];
    this.attributes = {};
    this.textContent = '';

    if (elementName === 'style') {
      this.sheet = {
        cssRules: [],
        insertRule(rule: string) {
          this.cssRules?.push(rule);
        }
      };
    }
  }

  setAttributeNS(name: string, value: string) {
    this.attributes[name] = xmlEncode(value || '');
  }

  appendChild(element: Omit<Element, 'parentNode'> & { parentNode: Element['parentNode'] }) {
    if (!this.childNodes.includes(element)) {
      this.childNodes.push(element);
      element.parentNode = this as unknown as Element;
    }
  }

  toString() {
    const attrList: string[] = [];
    Object.values(this.attributes).forEach((i) => {
      attrList.push(`${i}="${xmlEncode(this.attributes[i])}"`);
    });

    if (this.nodeName === 'svg:tspan' || this.nodeName === 'svg:style') {
      const encodedText = xmlEncode(this.textContent);
      return `<${this.nodeName} ${attrList.join(' ')}>${encodedText}</${this.nodeName}>`;
    }
    if (this.nodeName === 'svg:svg') {
      const ns =
        'xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="http://www.w3.org/2000/svg"';
      return `<${this.nodeName} ${ns} ${attrList.join(
        ' '
      )}>${this.childNodes.join('')}</${this.nodeName}>`;
    }
    return `<${this.nodeName} ${attrList.join(' ')}>${this.childNodes.join('')}</${this.nodeName}>`;
  }

  cloneNode() {
    const newNode = new DOMElement(this.nodeName);
    newNode.childNodes = this.childNodes;
    newNode.attributes = this.attributes;
    newNode.textContent = this.textContent;
    return newNode;
  }

  remove() {
    return this.parentNode?.removeChild(this as unknown as Element);
  }

  removeChild(element: Element) {
    const index = this.childNodes.indexOf(element);

    if (index !== -1) {
      this.childNodes = this.childNodes.splice(index, 1);
    }
  }
}

global.document = {
  childNodes: [],

  get currentScript() {
    return { src: '' };
  },

  get documentElement() {
    return this;
  },

  createElementNS(_: unknown, element: string) {
    return new DOMElement(element);
  },

  createElement(element: string) {
    return this.createElementNS('', element);
  },

  getElementsByTagName(element: string) {
    if (element === 'head') {
      if (!this.head) this.head = new DOMElement('head');
      return this.head;
    }
    return [];
  }
};

export type Merge = { row: number; col: number; width: number; height: number };
export type Merges = Record<string, Merge>;

export type MergeAlias = Record<string, string>;

export type PageTables = {
  page: number;
  tables: string[][];
  merges: Merges;
  merge_alias: MergeAlias;
  width: number;
  height: number;
};

export type PdfTableParseResult = {
  pageTables: PageTables[];
  numPages: number;
  currentPages: number;
};

const nullResult = {
  pageTables: [],
  numPages: 0,
  currentPages: 0
} as PdfTableParseResult;

const transform = (m1: number[], m2: number[]) => {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
};

const applyTransform = (p: number[], m: number[]) => {
  const xt = p[0] * m[0] + p[1] * m[2] + m[4];
  const yt = p[0] * m[1] + p[1] * m[3] + m[5];
  return [xt, yt];
};

const pdfTableParse = async (
  document: PDFDocumentProxy,
  options: ExtractPdfTableOptions
): Promise<PdfTableParseResult> => {
  const { numPages } = document;

  const result: PdfTableParseResult = {
    pageTables: [],
    numPages,
    currentPages: 0
  };

  const loadPage = (pageNum: number, opList: PDFOperatorList, content: TextContent) => {
    const verticals: { x: number; lines: Line[] }[] = [];
    const horizontals: { y: number; lines: Line[] }[] = [];

    let merges: Merges = {};
    let mergeAlias: MergeAlias = {};
    let transformMatrix = [1, 0, 0, 1, 0, 0];
    const transformStack: number[][] = [];

    // Get rectangle first
    const showed: Record<number, string> = {};
    const REVOPS: string[] = [];
    Object.keys(OPS).forEach((op) => {
      REVOPS[OPS[op as keyof typeof OPS]] = op;
    });

    let edges: {
      x: number;
      y: number;
      width: number;
      height: number;
      transform: number[];
    }[] = [];
    let currentX: number | undefined;
    let currentY: number | undefined;
    let lineWidth: number | undefined;
    const lineMaxWidth = 2;

    const maxEdgesPerPage = options.maxEdgesPerPage || Number.MAX_VALUE;

    while (opList.fnArray.length) {
      const fn = opList.fnArray.shift();
      const args = opList.argsArray.shift() as (number | number[])[];
      if (OPS.constructPath === fn && typeof args[0] !== 'number' && typeof args[1] !== 'number') {
        while (args[0].length) {
          const op = args[0].shift();
          if (op !== undefined && op === OPS.rectangle) {
            const x = args[1].shift() ?? NaN;
            const y = args[1].shift() ?? NaN;
            const width = args[1].shift() ?? NaN;
            const height = args[1].shift() ?? NaN;
            if (Math.min(width, height) < lineMaxWidth) {
              edges.push({ y, x, width, height, transform: transformMatrix });

              if (edges.length > maxEdgesPerPage) {
                // return no table
                return nullResult;
              }
            }
          } else if (op === OPS.moveTo) {
            currentX = args[1].shift();
            currentY = args[1].shift();
          } else if (op === OPS.lineTo) {
            const x = args[1].shift() ?? NaN;
            const y = args[1].shift() ?? NaN;
            if (currentX === x) {
              edges.push({
                y: Math.min(y, currentY ?? NaN),
                x: x - (lineWidth ?? NaN) / 2,
                width: lineWidth ?? NaN,
                height: Math.abs(y - (currentY ?? 0)),
                transform: transformMatrix
              });
            } else if (currentY === y) {
              edges.push({
                x: Math.min(x, currentX ?? 0),
                y: y - (lineWidth ?? NaN) / 2,
                height: lineWidth ?? NaN,
                width: Math.abs(x - (currentX ?? 0)),
                transform: transformMatrix
              });
            }
            currentX = x;
            currentY = y;

            if (edges.length > maxEdgesPerPage) {
              // return no table
              return nullResult;
            }
          }
        }
      } else if (OPS.save === fn) {
        transformStack.push(transformMatrix);
      } else if (OPS.restore === fn) {
        transformMatrix = transformStack.pop()!;
      } else if (OPS.transform === fn) {
        transformMatrix = transform(transformMatrix, args as number[]);
      } else if (OPS.setLineWidth === fn) {
        lineWidth = args[0] as number;
      } else if (REVOPS[fn!] !== 'eoFill' && typeof showed[fn!] === 'undefined') {
        showed[fn!] = REVOPS[fn!];
      }
    }

    edges = edges.map((edge) => {
      const point1 = applyTransform([edge.x, edge.y], edge.transform);
      const point2 = applyTransform([edge.x + edge.width, edge.y + edge.height], edge.transform);
      return {
        x: Math.min(point1[0], point2[0]),
        y: Math.min(point1[1], point2[1]),
        width: Math.abs(point1[0] - point2[0]),
        height: Math.abs(point1[1] - point2[1]),
        transform: undefined as unknown as typeof edge.transform
      };
    });

    // merge rectangle to vertical lines and horizon lines
    const edges1 = (JSON.parse(JSON.stringify(edges)) as typeof edges).toSorted(
      (a, b) => a.x - b.x || a.y - b.y
    );
    const edges2 = (JSON.parse(JSON.stringify(edges)) as typeof edges).toSorted(
      (a, b) => a.y - b.y || a.x - b.x
    );

    // get vertical lines
    currentX = NaN;
    currentY = NaN;
    let currentHeight = 0;

    type Line = {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };

    let lines: Line[] = [];
    let newLines: Line[] | undefined;

    const linesAddVertical = (
      defaultLines: Line[],
      defaultTop: number,
      defaultBottom: number
    ): Line[] => {
      let hit = false;
      let top = defaultTop;
      let bottom = defaultBottom;
      let verticalLines = defaultLines;
      for (let i = 0; i < verticalLines.length; i += 1) {
        const { bottom: lineBottom = NaN, top: lineTop = NaN } = verticalLines[i];

        if (lineBottom >= top && lineTop <= bottom) {
          hit = true;

          top = Math.min(lineTop, top);
          bottom = Math.max(lineBottom, bottom);
          if (i > 1) lines.slice(0, i - 1);
          newLines = [...verticalLines.slice(i + 1)];
          verticalLines = newLines;
          return linesAddVertical(verticalLines, top, bottom);
        }
      }

      if (!hit) {
        verticalLines.push({ top, bottom });
      }
      return verticalLines;
    };

    let edge: (typeof edges1)[0] | undefined;

    while (edge) {
      edge = edges1.shift();
      if (!edge) break;
      // skip horizon lines
      if (edge.width <= lineMaxWidth) {
        // new vertical lines
        if (Number.isNaN(currentX) || edge.x - currentX > lineMaxWidth) {
          if (currentHeight > lineMaxWidth) {
            lines = linesAddVertical(lines, currentY, currentY + currentHeight);
          }
          if (!Number.isNaN(currentX) && lines.length) {
            verticals.push({ x: currentX, lines });
          }
          currentX = edge.x;
          currentY = edge.y;
          currentHeight = 0;
          lines = [];
        }

        if (Math.abs(currentY + currentHeight - edge.y) < 10) {
          currentHeight = edge.height + edge.y - currentY;
        } else {
          if (currentHeight > lineMaxWidth) {
            lines = linesAddVertical(lines, currentY, currentY + currentHeight);
          }
          currentY = edge.y;
          currentHeight = edge.height;
        }
      }
    }

    if (currentHeight > lineMaxWidth) {
      lines = linesAddVertical(lines, currentY, currentY + currentHeight);
    }

    // no table
    if (Number.isNaN(currentX) || lines.length === 0) {
      return nullResult;
    }
    verticals.push({ x: currentX, lines });

    // Get horizon lines
    currentX = NaN;
    currentY = NaN;
    let currentWidth = 0;

    const linesAddHorizontal = (
      defaultLines: Line[],
      defaultLeft: number,
      defaultRight: number
    ): Line[] => {
      let hit = false;
      let left = defaultLeft;
      let right = defaultRight;
      const horizontalLines = defaultLines;
      for (let i = 0; i < horizontalLines.length; i += 1) {
        const { right: lineRight = NaN, left: lineLeft = NaN } = horizontalLines[i];

        if (lineRight >= left && lineLeft <= right) {
          hit = true;

          left = Math.min(lineLeft, left);
          right = Math.max(lineRight, right);
          if (i > 1) lines.slice(0, i - 1);
          newLines = [...lines.slice(i + 1)];
          lines = newLines;
          return linesAddHorizontal(lines, left, right);
        }
      }
      if (!hit) {
        lines.push({ left, right });
      }
      return lines;
    };

    while (edge) {
      edge = edges2.shift();

      if (!edge) break;

      if (edge.height <= lineMaxWidth) {
        if (Number.isNaN(currentY) || edge.y - currentY > lineMaxWidth) {
          if (currentWidth > lineMaxWidth) {
            lines = linesAddHorizontal(lines, currentX, currentX + currentWidth);
          }
          if (!Number.isNaN(currentY) && lines.length) {
            horizontals.push({ y: currentY, lines });
          }
          currentX = edge.x;
          currentY = edge.y;
          currentWidth = 0;
          lines = [];
        }

        if (Math.abs(currentX + currentWidth - edge.x) < 10) {
          currentWidth = edge.width + edge.x - currentX;
        } else {
          if (currentWidth > lineMaxWidth) {
            lines = linesAddHorizontal(lines, currentX, currentX + currentWidth);
          }
          currentX = edge.x;
          currentWidth = edge.width;
        }
      }
    }
    if (currentWidth > lineMaxWidth) {
      lines = linesAddHorizontal(lines, currentX, currentX + currentWidth);
    }
    // no table
    if (currentY === null || lines.length === 0) {
      return nullResult;
    }
    horizontals.push({ y: currentY, lines });

    const searchIndex = (v: number, list: number[]) => {
      for (let i = 0; i < list.length; i += 1) {
        if (Math.abs(list[i] - v) < 5) {
          return i;
        }
      }
      return -1;
    };

    // handle merge cells
    const xList = verticals.map((a) => a.x);

    // check topOut and bottomOut
    const yList = horizontals.map((a) => a.y).toSorted((a, b) => b - a);
    const yMax =
      verticals
        .map((vertical) => vertical.lines[0].bottom)
        .sort()
        .reverse()[0] ?? NaN;
    const yMin =
      verticals.map((vertical) => vertical.lines[vertical.lines.length - 1].top).sort()[0] ?? NaN;
    const topOut = searchIndex(yMin, yList) === -1 ? 1 : 0;
    const bottomOut = searchIndex(yMax, yList) === -1 ? 1 : 0;

    const verticalMerges: Merges = {};

    // skip the 1st lines and final lines
    for (let r = 0; r < horizontals.length - 2 + topOut + bottomOut; r += 1) {
      const hor = horizontals[bottomOut + horizontals.length - r - 2];
      lines = hor.lines.slice(0);
      let col = searchIndex(lines[0].left ?? 0, xList);
      if (col !== 0) {
        for (let c = 0; c < col; c += 1) {
          verticalMerges[[r, c].join('-')] = {
            row: r,
            col: c,
            width: 1,
            height: 2
          };
        }
      }

      let line: Line | undefined;

      while (line) {
        line = lines.shift();
        if (!line) break;

        const leftCol = searchIndex(line.left ?? NaN, xList);
        const rightCol = searchIndex(line.right ?? NaN, xList);
        if (leftCol !== col) {
          for (let c = col; c < leftCol; c += 1) {
            verticalMerges[[r, c].join('-')] = {
              row: r,
              col: c,
              width: 1,
              height: 2
            };
          }
        }
        col = rightCol;
      }
      if (col !== verticals.length - 1 + topOut) {
        for (let c = col; c < verticals.length - 1 + topOut; c += 1) {
          verticalMerges[[r, c].join('-')] = {
            row: r,
            col: c,
            width: 1,
            height: 2
          };
        }
      }
    }

    let merged = false;

    do {
      const verticalMergesValues = Object.values(verticalMerges);
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      const isOneMerged = verticalMergesValues.some((merge) => {
        let currenFinalId = `${merge.row + merge.height - 1}-${merge.col + merge.width - 1}`;
        while (undefined !== verticalMerges[currenFinalId]) {
          merge.height += verticalMerges[currenFinalId].height - 1;
          delete verticalMerges[currenFinalId];
          merged = true;
          currenFinalId = `${merge.row + merge.height - 1}-${merge.col + merge.width - 1}`;
        }

        return isOneMerged;
      });

      merged = isOneMerged;
    } while (!merged);

    const horizontalMerges: Merges = {};

    for (let c = 0; c < verticals.length - 2; c += 1) {
      const ver = verticals[c + 1];
      lines = ver.lines.slice(0);
      let row = searchIndex(lines[0].bottom ?? NaN, yList) + bottomOut;
      if (row !== 0) {
        for (let r = 0; r < row; r += 1) {
          horizontalMerges[[r, c].join('-')] = {
            row: r,
            col: c,
            width: 2,
            height: 1
          };
        }
      }

      let line: Line | undefined;

      while (line) {
        line = lines.shift();
        if (!line) break;

        let topRow = searchIndex(line.top ?? NaN, yList);

        if (topRow === -1) topRow = yList.length + bottomOut;
        else topRow += bottomOut;

        const bottomRow = searchIndex(line.bottom ?? NaN, yList) + bottomOut;

        if (bottomRow !== row) {
          for (let r = bottomRow; r < row; r += 1) {
            horizontalMerges[[r, c].join('-')] = {
              row: r,
              col: c,
              width: 2,
              height: 1
            };
          }
        }
        row = topRow;
      }
      if (row !== horizontals.length - 1 + bottomOut + topOut) {
        for (let r = row; r < horizontals.length - 1 + bottomOut + topOut; r += 1) {
          horizontalMerges[[r, c].join('-')] = {
            row: r,
            col: c,
            width: 2,
            height: 1
          };
        }
      }
    }
    if (topOut) {
      horizontals.unshift({ y: yMin, lines: [] });
    }
    if (bottomOut) {
      horizontals.push({ y: yMax, lines: [] });
    }

    do {
      const horizontalMergesValues = Object.values(horizontalMerges);
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      const isOneMerged = horizontalMergesValues.some((merge) => {
        let currenFinalId = `${merge.row + merge.height - 1}-${merge.col + merge.width - 1}`;
        while (undefined !== horizontalMerges[currenFinalId]) {
          merge.width += horizontalMerges[currenFinalId].width - 1;
          delete horizontalMerges[currenFinalId];
          merged = true;
          currenFinalId = `${merge.row + merge.height - 1}-${merge.col + merge.width - 1}`;
        }

        return isOneMerged;
      });

      merged = isOneMerged;
    } while (!merged);

    merges = verticalMerges;

    Object.keys(horizontalMerges).forEach((id) => {
      if (undefined !== merges[id]) {
        merges[id].width = horizontalMerges[id].width;
      } else {
        merges[id] = horizontalMerges[id];
      }
    });

    Object.values(merges).forEach((merge) => {
      for (let c = 0; c < merge.width; c += 1) {
        for (let r = 0; r < merge.height; r += 1) {
          if (c !== 0 || r !== 0) delete merges[[r + merge.row, c + merge.col].join('-')];
        }
      }
    });

    mergeAlias = {};

    Object.values(merges).forEach((merge) => {
      for (let c = 0; c < merge.width; c += 1) {
        for (let r = 0; r < merge.height; r += 1) {
          if (r !== 0 || c !== 0) {
            mergeAlias[[merge.row + r, merge.col + c].join('-')] = [merge.row, merge.col].join('-');
          }
        }
      }
    });

    const tables: string[][] = [];

    const tablePosition: (number | null)[][] = [];
    for (let i = 0; i < horizontals.length - 1; i += 1) {
      tables[i] = [];
      tablePosition[i] = [];
      for (let j = 0; j < verticals.length - 1; j += 1) {
        tables[i][j] = '';
        tablePosition[i][j] = null;
      }
    }

    let item: (typeof content.items)[0] | undefined;

    while (item) {
      item = content.items.shift();
      if (!item) break;

      if (!('transform' in item)) continue;

      const x = item.transform[4] as number;
      const y = item.transform[5] as number;

      let col = -1;
      for (let i = 0; i < verticals.length - 1; i += 1) {
        if (x >= verticals[i].x && x < verticals[i + 1].x) {
          col = i;
          break;
        }
      }
      if (col === -1) {
        continue;
      }
      let row = -1;
      for (let i = 0; i < horizontals.length - 1; i += 1) {
        if (y >= horizontals[i].y && y < horizontals[i + 1].y) {
          row = horizontals.length - i - 2;
          break;
        }
      }
      if (row === -1) continue;

      let id: string | undefined;
      if (undefined !== mergeAlias[`${row}-${col}`]) {
        id = mergeAlias[`${row}-${col}`];
        row = +id.split('-')[0];
        col = +id.split('-')[1];
      }
      if (tablePosition[row][col] !== null && Math.abs(+(tablePosition[row][col] ?? 0) - y) > 5) {
        tables[row][col] += '\n';
      }
      tablePosition[row][col] = y;
      tables[row][col] += item.str;
    }
    if (tables.length) {
      result.pageTables.push({
        page: pageNum,
        tables,
        merges,
        merge_alias: mergeAlias,
        width: verticals.length - 1,
        height: horizontals.length - 1
      });
    }
    result.currentPages += 1;
    if (options.progressFunc && typeof options.progressFunc === 'function')
      options.progressFunc(result);
    return result;
  };

  let table: PdfTableParseResult = nullResult;

  const documentPages = await Promise.all(
    Array.from({ length: numPages }).map(async (_, index) => {
      const page = await document.getPage(index);
      const opList = await page.getOperatorList();
      const content = await page.getTextContent();
      return { opList, content };
    })
  );

  for (let i = 1; i <= numPages; i += 1) {
    const page = documentPages[i];
    table = loadPage(i, page.opList, page.content);
  }

  return table;
};

export type ExtractPdfTableOptions = {
  maxEdgesPerPage?: number;
  progressFunc?: (page: PdfTableParseResult) => void;
};

export const extractPdfTable = async (
  buffer: ArrayBuffer,
  options: ExtractPdfTableOptions = {}
): Promise<PdfTableParseResult> => {
  const data = new Uint8Array(buffer);
  const pdfLoadingTask = getDocument({
    data,
    disableFontFace: false,
    useSystemFonts: true
  });
  const pdfDocument = await pdfLoadingTask.promise;

  const tables = await pdfTableParse(pdfDocument, options);

  await pdfLoadingTask.destroy();

  return tables;
};

export default extractPdfTable;
