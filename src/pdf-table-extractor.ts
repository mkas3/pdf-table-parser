import { getDocument, OPS, PDFDocumentProxy } from 'pdfjs-dist';

const xmlEncode = (str: any) => {
  let i = 0,
    ch: string;
  const newStr = String(str) as string;
  while (
    i < newStr.length &&
    (ch = newStr[i]) !== '&' &&
    ch !== '<' &&
    ch !== '"' &&
    ch !== '\n' &&
    ch !== '\r' &&
    ch !== '\t'
  ) {
    i++;
  }
  if (i >= newStr.length) {
    return newStr;
  }
  let buf = newStr.substring(0, i);
  while (i < newStr.length) {
    ch = newStr[i++];
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

type GlobalType = Omit<typeof global, 'document'> & {
  btoa: (chars: string) => string;
  document: {
    head?: HTMLHeadElement | typeof DOMElement;
    childNodes: ChildNode[];
    currentScript: { src: string };
    documentElement: any;
    createElementNS: (_: any, element: string) => typeof DOMElement;
    createElement: (element: string) => typeof DOMElement;
    getElementsByTagName: (element: string) => any[];
  };
};

(global as unknown as GlobalType).btoa = function btoa(chars: string) {
  const digits =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let buffer = '';
  let i: number, n: number;
  for (i = 0, n = chars.length; i < n; i += 3) {
    const b1 = chars.charCodeAt(i) & 0xff;
    const b2 = chars.charCodeAt(i + 1) & 0xff;
    const b3 = chars.charCodeAt(i + 2) & 0xff;
    const d1 = b1 >> 2,
      d2 = ((b1 & 3) << 4) | (b2 >> 4);
    const d3 = i + 1 < n ? ((b2 & 0xf) << 2) | (b3 >> 6) : 64;
    const d4 = i + 2 < n ? b3 & 0x3f : 64;
    buffer +=
      digits.charAt(d1) +
      digits.charAt(d2) +
      digits.charAt(d3) +
      digits.charAt(d4);
  }
  return buffer;
};

function DOMElement(
  this: Record<string, any> & { nodeName: string },
  name: string
) {
  this.nodeName = name;
  this.childNodes = [];
  this.attributes = {};
  this.textContent = '';

  if (name === 'style') {
    this.sheet = {
      cssRules: [],
      insertRule(rule: string) {
        this.cssRules.push(rule);
      },
    };
  }
}

DOMElement.prototype = {
  setAttributeNS(
    this: Record<string, any>,
    _: any,
    name: string,
    value: string
  ) {
    value = value || '';
    value = xmlEncode(value);
    this.attributes[name] = value;
  },

  appendChild(
    this: Record<string, any>,
    element: Omit<Element, 'parentNode'> & { parentNode: Element['parentNode'] }
  ) {
    if (this.childNodes.indexOf(element) === -1) {
      this.childNodes.push(element);
      // @ts-expect-error asd
      element.parentNode = this;
    }
  },

  // appendChild(
  //   this: Record<string, any>,
  //   element: Omit<Element, 'parentNode'> & { parentNode: Element['parentNode'] }
  // ) {
  //   const childNodes = this.childNodes;
  //   if (childNodes.indexOf(element) === -1) {
  //     childNodes.push(element);
  //   }
  // },

  toString(this: Record<string, any>) {
    const attrList = [] as string[];
    for (const i in this.attributes) {
      attrList.push(i + '="' + xmlEncode(this.attributes[i]) + '"');
    }

    if (this.nodeName === 'svg:tspan' || this.nodeName === 'svg:style') {
      const encodedText = xmlEncode(this.textContent);
      return (
        '<' +
        this.nodeName +
        ' ' +
        attrList.join(' ') +
        '>' +
        encodedText +
        '</' +
        this.nodeName +
        '>'
      );
    } else if (this.nodeName === 'svg:svg') {
      const ns =
        'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
        'xmlns:svg="http://www.w3.org/2000/svg"';
      return (
        '<' +
        this.nodeName +
        ' ' +
        ns +
        ' ' +
        attrList.join(' ') +
        '>' +
        this.childNodes.join('') +
        '</' +
        this.nodeName +
        '>'
      );
    } else {
      return (
        '<' +
        this.nodeName +
        ' ' +
        attrList.join(' ') +
        '>' +
        this.childNodes.join('') +
        '</' +
        this.nodeName +
        '>'
      );
    }
  },

  cloneNode(this: Record<string, any>) {
    const newNode = new DOMElement(this.nodeName);
    newNode.childNodes = this.childNodes;
    newNode.attributes = this.attributes;
    newNode.textContent = this.textContent;
    return newNode;
  },

  remove(this: Record<string, any>) {
    if (this.parentNode) {
      return this.parentNode.removeChild(this);
    }
    return;
  },

  removeChild(this: Record<string, any>, element: Element) {
    const index = this.childNodes.indexOf(element);

    if (index > -1) {
      this.childNodes = this.childNodes.splice(index, 1);
    }
  },
};

(global as unknown as GlobalType).document = {
  childNodes: [],

  get currentScript() {
    return { src: '' };
  },

  get documentElement() {
    return this;
  },

  createElementNS(_: any, element: string) {
    return new DOMElement(element);
  },

  createElement(element: string) {
    return this.createElementNS('', element);
  },

  getElementsByTagName(element: string) {
    if (element === 'head') {
      return [this.head || (this.head = new DOMElement('head'))];
    }
    return [];
  },
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
  currentPages: 0,
} as PdfTableParseResult;

const transform = function (m1: number[], m2: number[]) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
};

const applyTransform = function (p: number[], m: number[]) {
  const xt = p[0] * m[0] + p[1] * m[2] + m[4];
  const yt = p[0] * m[1] + p[1] * m[3] + m[5];
  return [xt, yt];
};

const pdfTableParse = async (
  document: PDFDocumentProxy,
  options: ExtractPdfTableOptions
): Promise<PdfTableParseResult> => {
  const numPages = document.numPages;

  const result: PdfTableParseResult = {
    pageTables: [],
    numPages: numPages,
    currentPages: 0,
  };

  const loadPage = async (pageNum: number) => {
    const page = await document.getPage(pageNum);

    const verticals: { x: number; lines: Line[] }[] = [];
    const horizontals: { y: number; lines: Line[] }[] = [];

    let merges: Merges = {};
    let mergeAlias: MergeAlias = {};
    let transformMatrix = [1, 0, 0, 1, 0, 0];
    const transformStack: number[][] = [];

    const opList = await page.getOperatorList();

    // Get rectangle first
    const showed: Record<number, any> = {};
    const REVOPS: string[] = [];
    for (const op in OPS) {
      REVOPS[OPS[op]] = op;
    }

    let edges: {
      x: number;
      y: number;
      width: number;
      height: number;
      transform: number[];
    }[] = [];
    let currentX: number | undefined, currentY: number | undefined;
    let lineWidth: number | undefined;
    const lineMaxWidth = 2;

    const maxEdgesPerPage = options.maxEdgesPerPage || Number.MAX_VALUE;

    while (opList.fnArray.length) {
      const fn = opList.fnArray.shift();
      const args = opList.argsArray.shift();
      if (OPS.constructPath == fn) {
        while (args[0].length) {
          const op = args[0].shift();
          if (op == OPS.rectangle) {
            const x = args[1].shift();
            const y = args[1].shift();
            const width = args[1].shift();
            const height = args[1].shift();
            if (Math.min(width, height) < lineMaxWidth) {
              edges.push({ y, x, width, height, transform: transformMatrix });

              if (edges.length > maxEdgesPerPage) {
                // return no table
                return nullResult;
              }
            }
          } else if (op == OPS.moveTo) {
            currentX = args[1].shift();
            currentY = args[1].shift();
          } else if (op == OPS.lineTo) {
            const x = args[1].shift();
            const y = args[1].shift();
            if (currentX == x) {
              edges.push({
                y: Math.min(y, currentY ?? NaN),
                x: x - (lineWidth ?? NaN) / 2,
                width: lineWidth ?? NaN,
                height: Math.abs(y - (currentY ?? 0)),
                transform: transformMatrix,
              });
            } else if (currentY == y) {
              edges.push({
                x: Math.min(x, currentX ?? 0),
                y: y - (lineWidth ?? NaN) / 2,
                height: lineWidth ?? NaN,
                width: Math.abs(x - (currentX ?? 0)),
                transform: transformMatrix,
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
      } else if (OPS.save == fn) {
        transformStack.push(transformMatrix);
      } else if (OPS.restore == fn) {
        transformMatrix = transformStack.pop()!;
      } else if (OPS.transform == fn) {
        transformMatrix = transform(transformMatrix, args);
      } else if (OPS.setStrokeRGBColor == fn) {
      } else if (OPS.setFillRGBColor == fn) {
      } else if (OPS.setLineWidth == fn) {
        lineWidth = args[0];
      } else if (['eoFill'].indexOf(REVOPS[fn!]) >= 0) {
      } else if ('undefined' === typeof showed[fn!]) {
        showed[fn!] = REVOPS[fn!];
      } else {
      }
    }

    edges = edges.map((edge) => {
      const point1 = applyTransform([edge.x, edge.y], edge.transform);
      const point2 = applyTransform(
        [edge.x + edge.width, edge.y + edge.height],
        edge.transform
      );
      return {
        x: Math.min(point1[0], point2[0]),
        y: Math.min(point1[1], point2[1]),
        width: Math.abs(point1[0] - point2[0]),
        height: Math.abs(point1[1] - point2[1]),
        transform: undefined as unknown as typeof edge.transform,
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
    let current_x = NaN;
    let current_y = NaN;
    let current_height = 0;

    type Line = {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };

    let lines: Line[] = [];
    let new_lines: Line[] | undefined;

    const lines_add_vertical = (
      lines: Line[],
      top: number,
      bottom: number
    ): Line[] => {
      let hit = false;
      for (let i = 0; i < lines.length; i++) {
        const { bottom: lineBottom = NaN, top: lineTop = NaN } = lines[i];

        if (lineBottom < top || lineTop > bottom) {
          continue;
        }
        hit = true;

        top = Math.min(lineTop, top);
        bottom = Math.max(lineBottom, bottom);
        if (i > 1) lines.slice(0, i - 1);
        new_lines = [...lines.slice(i + 1)];
        lines = new_lines;
        return lines_add_vertical(lines, top, bottom);
      }
      if (!hit) {
        lines.push({ top, bottom });
      }
      return lines;
    };

    let edge: (typeof edges1)[0] | undefined;

    while ((edge = edges1.shift())) {
      // skip horizon lines
      if (edge.width > lineMaxWidth) {
        continue;
      }

      // new vertical lines
      if (isNaN(current_x) || edge.x - current_x > lineMaxWidth) {
        if (current_height > lineMaxWidth) {
          lines = lines_add_vertical(
            lines,
            current_y,
            current_y + current_height
          );
        }
        if (!isNaN(current_x) && lines.length) {
          verticals.push({ x: current_x, lines: lines });
        }
        current_x = edge.x;
        current_y = edge.y;
        current_height = 0;
        lines = [];
      }

      if (Math.abs(current_y + current_height - edge.y) < 10) {
        current_height = edge.height + edge.y - current_y;
      } else {
        if (current_height > lineMaxWidth) {
          lines = lines_add_vertical(
            lines,
            current_y,
            current_y + current_height
          );
        }
        current_y = edge.y;
        current_height = edge.height;
      }
    }
    if (current_height > lineMaxWidth) {
      lines = lines_add_vertical(lines, current_y, current_y + current_height);
    }

    // no table
    if (isNaN(current_x) || lines.length == 0) {
      return nullResult;
    }
    verticals.push({ x: current_x, lines });

    // Get horizon lines
    current_x = NaN;
    current_y = NaN;
    let current_width = 0;

    const lines_add_horizon = (
      lines: Line[],
      left: number,
      right: number
    ): Line[] => {
      let hit = false;
      for (let i = 0; i < lines.length; i++) {
        const { right: lineRight = NaN, left: lineLeft = NaN } = lines[i];
        if (lineRight < left || lineLeft > right) {
          continue;
        }
        hit = true;

        left = Math.min(lineLeft, left);
        right = Math.max(lineRight, right);
        if (i > 1) lines.slice(0, i - 1);
        new_lines = [...lines.slice(i + 1)];
        lines = new_lines;
        return lines_add_horizon(lines, left, right);
      }
      if (!hit) {
        lines.push({ left: left, right: right });
      }
      return lines;
    };

    while ((edge = edges2.shift())) {
      if (edge.height > lineMaxWidth) {
        continue;
      }
      if (isNaN(current_y) || edge.y - current_y > lineMaxWidth) {
        if (current_width > lineMaxWidth) {
          lines = lines_add_horizon(
            lines,
            current_x,
            current_x + current_width
          );
        }
        if (!isNaN(current_y) && lines.length) {
          horizontals.push({ y: current_y, lines });
        }
        current_x = edge.x;
        current_y = edge.y;
        current_width = 0;
        lines = [];
      }

      if (Math.abs(current_x + current_width - edge.x) < 10) {
        current_width = edge.width + edge.x - current_x;
      } else {
        if (current_width > lineMaxWidth) {
          lines = lines_add_horizon(
            lines,
            current_x,
            current_x + current_width
          );
        }
        current_x = edge.x;
        current_width = edge.width;
      }
    }
    if (current_width > lineMaxWidth) {
      lines = lines_add_horizon(lines, current_x, current_x + current_width);
    }
    // no table
    if (current_y === null || lines.length == 0) {
      return nullResult;
    }
    horizontals.push({ y: current_y, lines });

    const searchIndex = (v: number, list: number[]) => {
      for (let i = 0; i < list.length; i++) {
        if (Math.abs(list[i] - v) < 5) {
          return i;
        }
      }
      return -1;
    };

    // handle merge cells
    const x_list = verticals.map((a) => a.x);

    // check top_out and bottom_out
    const y_list = horizontals.map((a) => a.y).toSorted((a, b) => b - a);
    const y_max =
      verticals
        .map((vertical) => vertical.lines[0].bottom)
        .sort()
        .reverse()[0] ?? NaN;
    const y_min =
      verticals
        .map((vertical) => vertical.lines[vertical.lines.length - 1].top)
        .sort()[0] ?? NaN;
    const top_out = searchIndex(y_min, y_list) == -1 ? 1 : 0;
    const bottom_out = searchIndex(y_max, y_list) == -1 ? 1 : 0;

    const vertical_merges: Merges = {};

    // skip the 1st lines and final lines
    for (let r = 0; r < horizontals.length - 2 + top_out + bottom_out; r++) {
      const hor = horizontals[bottom_out + horizontals.length - r - 2];
      lines = hor.lines.slice(0);
      let col = searchIndex(lines[0].left ?? 0, x_list);
      if (col != 0) {
        for (let c = 0; c < col; c++) {
          vertical_merges[[r, c].join('-')] = {
            row: r,
            col: c,
            width: 1,
            height: 2,
          };
        }
      }

      let line: Line | undefined;

      while ((line = lines.shift())) {
        const left_col = searchIndex(line.left ?? NaN, x_list);
        const right_col = searchIndex(line.right ?? NaN, x_list);
        if (left_col != col) {
          for (let c = col; c < left_col; c++) {
            vertical_merges[[r, c].join('-')] = {
              row: r,
              col: c,
              width: 1,
              height: 2,
            };
          }
        }
        col = right_col;
      }
      if (col != verticals.length - 1 + top_out) {
        for (let c = col; c < verticals.length - 1 + top_out; c++) {
          vertical_merges[[r, c].join('-')] = {
            row: r,
            col: c,
            width: 1,
            height: 2,
          };
        }
      }
    }

    while (true) {
      let merged = false;
      for (const r_c in vertical_merges) {
        const m = vertical_merges[r_c];
        let curr_final_id = `${m.row + m.height - 1}-${m.col + m.width - 1}`;
        while (undefined !== vertical_merges[curr_final_id]) {
          m.height += vertical_merges[curr_final_id].height - 1;
          delete vertical_merges[curr_final_id];
          merged = true;
          curr_final_id = `${m.row + m.height - 1}-${m.col + m.width - 1}`;
        }

        if (merged) break;
      }
      if (!merged) {
        break;
      }
    }

    const horizon_merges: Merges = {};

    for (let c = 0; c < verticals.length - 2; c++) {
      const ver = verticals[c + 1];
      lines = ver.lines.slice(0);
      let row = searchIndex(lines[0].bottom ?? NaN, y_list) + bottom_out;
      if (row != 0) {
        for (let r = 0; r < row; r++) {
          horizon_merges[[r, c].join('-')] = {
            row: r,
            col: c,
            width: 2,
            height: 1,
          };
        }
      }

      let line: Line | undefined;
      while ((line = lines.shift())) {
        let top_row = searchIndex(line.top ?? NaN, y_list);
        if (top_row == -1) {
          top_row = y_list.length + bottom_out;
        } else {
          top_row += bottom_out;
        }
        const bottom_row = searchIndex(line.bottom ?? NaN, y_list) + bottom_out;
        if (bottom_row != row) {
          for (let r = bottom_row; r < row; r++) {
            horizon_merges[[r, c].join('-')] = {
              row: r,
              col: c,
              width: 2,
              height: 1,
            };
          }
        }
        row = top_row;
      }
      if (row != horizontals.length - 1 + bottom_out + top_out) {
        for (
          let r = row;
          r < horizontals.length - 1 + bottom_out + top_out;
          r++
        ) {
          horizon_merges[[r, c].join('-')] = {
            row: r,
            col: c,
            width: 2,
            height: 1,
          };
        }
      }
    }
    if (top_out) {
      horizontals.unshift({ y: y_min, lines: [] });
    }
    if (bottom_out) {
      horizontals.push({ y: y_max, lines: [] });
    }

    while (true) {
      let merged = false;
      for (const r_c in horizon_merges) {
        const m = horizon_merges[r_c];
        let curr_final_id = `${m.row + m.height - 1}-${m.col + m.width - 1}`;
        while (undefined !== horizon_merges[curr_final_id]) {
          m.width += horizon_merges[curr_final_id].width - 1;
          delete horizon_merges[curr_final_id];
          merged = true;
          curr_final_id = `${m.row + m.height - 1}-${m.col + m.width - 1}`;
        }

        if (merged) break;
      }
      if (!merged) {
        break;
      }
    }

    merges = vertical_merges;
    for (const id in horizon_merges) {
      if (undefined !== merges[id]) {
        merges[id].width = horizon_merges[id].width;
      } else {
        merges[id] = horizon_merges[id];
      }
    }
    for (const id in merges) {
      for (let c = 0; c < merges[id].width; c++) {
        for (let r = 0; r < merges[id].height; r++) {
          if (c == 0 && r == 0) {
            continue;
          }
          delete merges[[r + merges[id].row, c + merges[id].col].join('-')];
        }
      }
    }

    mergeAlias = {};
    for (const id in merges) {
      for (let c = 0; c < merges[id].width; c++) {
        for (let r = 0; r < merges[id].height; r++) {
          if (r == 0 && c == 0) {
            continue;
          }
          mergeAlias[[merges[id].row + r, merges[id].col + c].join('-')] = [
            merges[id].row,
            merges[id].col,
          ].join('-');
        }
      }
    }

    const content = await page.getTextContent();
    const tables: string[][] = [];
    const table_pos: (string | null)[][] = [];
    for (let i = 0; i < horizontals.length - 1; i++) {
      tables[i] = [];
      table_pos[i] = [];
      for (let j = 0; j < verticals.length - 1; j++) {
        tables[i][j] = '';
        table_pos[i][j] = null;
      }
    }

    let item: (typeof content.items)[0] | undefined;

    while ((item = content.items.shift())) {
      if (!('transform' in item)) continue;

      const x = item.transform[4];
      const y = item.transform[5];

      let col = -1;
      for (let i = 0; i < verticals.length - 1; i++) {
        if (x >= verticals[i].x && x < verticals[i + 1].x) {
          col = i;
          break;
        }
      }
      if (col == -1) {
        continue;
      }
      let row = -1;
      for (let i = 0; i < horizontals.length - 1; i++) {
        if (y >= horizontals[i].y && y < horizontals[i + 1].y) {
          row = horizontals.length - i - 2;
          break;
        }
      }
      if (row == -1) {
        continue;
      }

      let id: string | undefined;
      if (undefined !== mergeAlias[row + '-' + col]) {
        id = mergeAlias[row + '-' + col];
        row = +id.split('-')[0];
        col = +id.split('-')[1];
      }
      if (
        null !== table_pos[row][col] &&
        Math.abs(+(table_pos[row][col] ?? 0) - y) > 5
      ) {
        tables[row][col] += '\n';
      }
      table_pos[row][col] = y;
      tables[row][col] += item.str;
    }
    if (tables.length) {
      result.pageTables.push({
        page: pageNum,
        tables: tables,
        merges: merges,
        merge_alias: mergeAlias,
        width: verticals.length - 1,
        height: horizontals.length - 1,
      });
    }
    result.currentPages++;
    if (options.progressFunc && 'function' === typeof options.progressFunc)
      options.progressFunc(result);
    return result;
  };

  let pages: PdfTableParseResult = nullResult;

  for (let i = 1; i <= numPages; i++) {
    pages = await loadPage(i);
  }

  return pages;
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
    useSystemFonts: true,
  });
  const pdfDocument = await pdfLoadingTask.promise;

  const tables = await pdfTableParse(pdfDocument, options);

  await pdfLoadingTask.destroy();

  return tables;
};

export default extractPdfTable;
