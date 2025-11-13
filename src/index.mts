const OPEN_BLOCK = 123;
const CLOSE_BLOCK = 125;
const OPEN_CALL = 40;
const CLOSE_CALL = 41;
const SLASH = 47;
const ASTERISK = 42;
const AT = 64;
const ESC = 92;
const COMMA = 44;
const SEMI = 59;
const DOUBLE_QUOTE = 34;
const SINGLE_QUOTE = 39;
const OPEN_SQUARE_BRACKET = 91;
const CLOSE_SQUARE_BRACKET = 93;

interface BracketLevels {
  [OPEN_CALL]: number;
  [CLOSE_CALL]: number;
  [OPEN_SQUARE_BRACKET]: number;
  [CLOSE_SQUARE_BRACKET]: number;
}

function isWordChar(char: number, withBracket: boolean = true): boolean {
  return (
    (char >= 48 && char <= 57) ||
    (char >= 65 && char <= 90) ||
    (char >= 97 && char <= 122) ||
    char === 95 ||
    char === 36 ||
    (withBracket && char === OPEN_SQUARE_BRACKET) ||
    (withBracket && char === CLOSE_SQUARE_BRACKET) ||
    char === 45
  );
}

function isWhitespace(char: number): boolean {
  return (
    char === 32 ||
    char === 9 ||
    char === 10 ||
    char === 13 ||
    char === 12 ||
    char === 11 ||
    char === 0x00a0 ||
    char === 0x1680 ||
    (char >= 0x2000 && char <= 0x200a) ||
    char === 0x2028 ||
    char === 0x2029 ||
    char === 0x202f ||
    char === 0x205f ||
    char === 0x3000 ||
    char === 0xfeff
  );
}

if (process.env.NODE_ENV === "production")
  enum NodeType {
    Unknown,
    StyleSheet,
    DoubleQuote,
    SingleQuote,
    CommentBlock,
    BlockStatement,
    CallStatement,
    ForStatement,
    DirectiveDeclaration,
  }
else {
  enum NodeType {
    Unknown = "Unknown",
    StyleSheet = "StyleSheet",
    DoubleQuote = "DoubleQuote",
    SingleQuote = "SingleQuote",
    CommentBlock = "CommentBlock",
    BlockStatement = "BlockStatement",
    CallStatement = "CallStatement",
    ForStatement = "ForStatement",
    DirectiveDeclaration = "DirectiveDeclaration",
  }
}

function getName(level: NodeType) {
  switch (level) {
    case NodeType.DoubleQuote:
    case NodeType.SingleQuote:
      return "string constant";
    case NodeType.CommentBlock:
      return "comment";
    case NodeType.BlockStatement:
      return "code block statement";
    case NodeType.CallStatement:
      return "parentheses block statement";
    case NodeType.DirectiveDeclaration:
      return "directive declaration constant";
  }
  return `${level}`;
}

interface Node {
  start?: number;
  end?: number;
  line?: number;
  column?: number;
  body?: Node | Node[];
  value?: string;
  args?: Node | string[];
  type: NodeType;
  name?: string;
  id?: string;
  semi?: boolean;
}

interface SyntaxError {
  name: string;
  message: string;
  loc: { line: number; column: number; index: number };
}

interface Context {
  type?: NodeType;
  wantBracket?: boolean;
  lastRelevantChild?: Node;
  possibleForStatement?: boolean;
  token: number[];
  bracketLevels: BracketLevels;
  parent: Node;
  child: Node;
}

function newContext(
  type: NodeType = NodeType.StyleSheet,
  start?: number,
  possibleForStatement: boolean = false,
  line?: number,
  column?: number
): Context {
  const result: Context = {
    child: {
      type: NodeType.Unknown,
      start: -1,
      end: -1,
    },
    token: [],
    bracketLevels: {
      [OPEN_CALL]: 0,
      [CLOSE_CALL]: 0,
      [OPEN_SQUARE_BRACKET]: 0,
      [CLOSE_SQUARE_BRACKET]: 0,
    },
    parent: { line, column, start, type, body: [] },
    possibleForStatement,
  };
  if (type === NodeType.CallStatement && !possibleForStatement)
    result.parent.args = [];
  return result;
}

const clearESC = (text: string) =>
  text
    .replaceAll("\\\\", ";%PH672%;")
    .replaceAll("\\", "")
    .replaceAll(";%PH672%;", "\\")
    .trim();

interface SyntaxErrorInput {
  msg: string;
  name?: string;
  subColumn?: number;
  line?: number;
  column?: number;
  index?: number;
}

function syntaxError({
  name = "SyntaxError",
  msg,
  subColumn = 1,
  line,
  column,
  index,
}: SyntaxErrorInput) {
  column = Math.max(1, (column as number) - subColumn);
  line = Math.max(1, line as number);
  return {
    name,
    message: `${name}: ${msg}. (${line}:${column})`,
    loc: { line, column, index: index as number },
  };
}

function parseCallStatement(
  currentChar: number,
  parent: Node,
  wantBracket: boolean | undefined,
  currentOpen: NodeType,
  token: number[],
  isEscaped: boolean
) {
  if (!wantBracket) {
    if (
      currentOpen !== NodeType.SingleQuote &&
      currentOpen !== NodeType.DoubleQuote &&
      !isEscaped &&
      currentChar === COMMA
    ) {
      (parent.args as string[]).push(clearESC(String.fromCharCode(...token)));
      token.length = 0;
      return;
    }
    token.push(currentChar);
  }
}

function errorIfForStatement(
  errorStore: SyntaxError[],
  lastRelevantChild: Node | undefined
) {
  if (lastRelevantChild?.type === NodeType.ForStatement) {
    lastRelevantChild.type = NodeType.Unknown;
    const { line, column, start } = lastRelevantChild;
    errorStore.push(
      syntaxError({
        name: "Unterminated",
        msg: "for loop statement",
        line: line as number,
        column: column as number,
        index: start as number,
      })
    );
  }
}
function parseOpenForStatement(
  currentChar: number,
  token: number[],
  ctx: Context,
  parent: Node
): number | Partial<SyntaxErrorInput> {
  if (parent.args) return 0;

  if (!ctx.wantBracket && (token.length > 0 || !isWhitespace(currentChar))) {
    if (isWordChar(currentChar, !parent.id)) token.push(currentChar);
    else if (!parent.id) {
      parent.id = String.fromCharCode(...token);
      token.length = 0;
    } else if (token.length === 2 && token[0] === 105 && token[1] === 110) {
      ctx.wantBracket = true;
      token.length = 0;
    } else {
      return {
        name: "Invalid",
        msg: "'in' was expected in the for loop statement",
        subColumn: token.length + 1,
      };
    }
  }

  if (ctx.wantBracket) {
    if (currentChar === OPEN_SQUARE_BRACKET) {
      ctx.wantBracket = false;
      parent.args = [];
    } else if (!isWhitespace(currentChar)) {
      return {
        name: "Invalid",
        msg: "'[' (opening square bracket) was expected in the for loop statement",
      };
    }
    return 1;
  }
  return 1;
}

interface ToggleNodeInput {
  ctx: Context;
  index: number;
  line: number;
  column: number;
  errorStore: SyntaxError[];
  child: Node;
  parentBody: Node[];
  type: NodeType;
  isRelevantChild?: boolean;
  plus?: number;
  error?: SyntaxErrorInput;
}

function toggleNode({
  index,
  line,
  column,
  errorStore,
  ctx,
  child,
  parentBody,
  isRelevantChild,
  type,
  plus = 1,
}: ToggleNodeInput) {
  const isOpen = child.type === type;
  if (isOpen) {
    if (
      type !== NodeType.CommentBlock &&
      type !== NodeType.SingleQuote &&
      type !== NodeType.DoubleQuote
    ) {
      child.end = index + plus;
      if (child.name === "for") {
        child.type = NodeType.ForStatement;
        delete child.name;
        delete child.id;
      }
      parentBody.push(child);
      ctx.lastRelevantChild = isRelevantChild ? child : undefined;
    }
    ctx.child = {
      type: NodeType.Unknown,
      start: -1,
      end: -1,
    };
  } else {
    errorIfForStatement(errorStore, ctx.lastRelevantChild);
    child.type = type;
    child.start = index;
    child.line = line;
    child.column = column;
  }
}

function parseOpenDirectiveDeclaration(
  currentChar: number,
  child: Node,
  token: number[]
): number | Partial<ToggleNodeInput> {
  if (child.type === NodeType.DirectiveDeclaration) {
    if (isWordChar(currentChar)) token.push(currentChar);
    else {
      if (!child.name) {
        child.name = String.fromCharCode(...token);
        token.length = 0;
      } else if (token.length === 0 && isWhitespace(currentChar)) {
        return 1;
      } else {
        child.id = String.fromCharCode(...token);
        token.length = 0;
        const semi = currentChar === SEMI;
        if (semi) child.semi = true;
        return {
          type: NodeType.DirectiveDeclaration,
          plus: semi ? 1 : 0,
          isRelevantChild: true,
        };
      }
    }
  }
  return 0;
}

function checkLevels(
  line: number,
  lastColumn: number,
  currentChar: number,
  nextChar: number,
  currentOpen: NodeType,
  isNewLine: boolean,
  isUnknown: boolean,
  isEscaped: boolean
): number | Partial<ToggleNodeInput> {
  if (isUnknown) {
    if (currentChar === SLASH && nextChar === ASTERISK) {
      return { type: NodeType.CommentBlock };
    }
  } else {
    if (currentOpen === NodeType.CommentBlock) {
      if (currentChar === ASTERISK && nextChar === SLASH) {
        return { type: NodeType.CommentBlock, plus: 2 };
      }
      return 1;
    }

    if (isNewLine && !isEscaped) {
      if (currentOpen === NodeType.DoubleQuote) {
        return {
          type: NodeType.DoubleQuote,
          error: {
            name: "Unterminated",
            msg: "string constant",
            line: line - 1,
            column: lastColumn,
          },
        };
      } else if (currentOpen === NodeType.SingleQuote)
        return {
          type: NodeType.SingleQuote,
          error: {
            name: "Unterminated",
            msg: "string constant",
            line: line - 1,
            column: lastColumn,
          },
        };
    }
  }

  if (
    currentChar === DOUBLE_QUOTE &&
    ((currentOpen === NodeType.DoubleQuote && !isEscaped) ||
      currentOpen === NodeType.Unknown)
  )
    return { type: NodeType.DoubleQuote };

  if (
    currentChar === SINGLE_QUOTE &&
    ((currentOpen === NodeType.SingleQuote && !isEscaped) ||
      currentOpen === NodeType.Unknown)
  )
    return { type: NodeType.SingleQuote };

  return 0;
}

function checkBracketLevel(
  currentChar: number,
  bracketLevels: BracketLevels,
  open: keyof BracketLevels,
  close: keyof BracketLevels
) {
  if (currentChar === open) bracketLevels[open]++;
  else if (currentChar === close) {
    bracketLevels[close]++;
    if (bracketLevels[close] - bracketLevels[open] >= 1) return true;
  }
  return false;
}

function parseIsUnknown(
  index: number,
  line: number,
  column: number,
  ctx: Context,
  parentType: NodeType,
  currentChar: number,
  bracketLevels: BracketLevels
): number | Partial<Context> {
  if (parentType !== NodeType.CallStatement) {
    if (parentType === NodeType.BlockStatement && currentChar === CLOSE_BLOCK)
      return 1;
    else if (currentChar === OPEN_BLOCK || currentChar === OPEN_CALL)
      return newContext(
        currentChar === OPEN_BLOCK
          ? NodeType.BlockStatement
          : NodeType.CallStatement,
        index,
        ctx.lastRelevantChild?.type === NodeType.ForStatement,
        line,
        column
      );
    else if (currentChar === AT) return { type: NodeType.DirectiveDeclaration };
  } else {
    if (checkBracketLevel(currentChar, bracketLevels, OPEN_CALL, CLOSE_CALL))
      return 1;
    if (ctx.wantBracket === false) {
      ctx.wantBracket = checkBracketLevel(
        currentChar,
        bracketLevels,
        OPEN_SQUARE_BRACKET,
        CLOSE_SQUARE_BRACKET
      );
    }
  }
  return 0;
}

function parse(text: string): {
  ast: Node;
  error: SyntaxError[] | undefined;
} {
  const textEnd = text.length;
  let escCount = 0;
  const errorStore: SyntaxError[] = [];
  let ctx = newContext();
  const standbyCtx: Context[] = [];
  let line = 1;
  let column = 0;
  let lastColumn = 0;
  let index = 0;
  let lastIndex = 0;
  let endCtx: typeof CLOSE_BLOCK | typeof CLOSE_CALL | undefined;
  while (index < textEnd) {
    const currentChar = text.charCodeAt(index);
    const nextChar = text.charCodeAt(index + 1);

    const CRLF = currentChar === 13 && nextChar === 10;
    const isNewLine = CRLF || currentChar === 10;
    if (index > lastIndex) {
      if (CRLF) index++;
      if (isNewLine) {
        line++;
        lastColumn = column;
        column = 0;
      }
      column++;
      lastIndex = index;
    }

    const { child, parent, possibleForStatement, token, bracketLevels } = ctx;
    const parentBody = parent.body as Node[];
    const parenType = parent.type;
    let result: number | object;

    if (endCtx) {
      let plus = 1;
      if (endCtx === CLOSE_CALL) {
        if (parentBody) delete parent.body;
        if (parent.args && token.length > 0)
          (parent.args as string[]).push(
            clearESC(String.fromCharCode(...token))
          );
        const semi = nextChar === SEMI;
        if (semi) {
          parent.semi = true;
          plus = 2;
        }
      }
      parent.end = index + plus;
      if (standbyCtx.length > 0) ctx = standbyCtx.pop() as Context;
      else break;
      const lastRelevantChild = ctx.lastRelevantChild;
      if (lastRelevantChild && !lastRelevantChild.body) {
        lastRelevantChild.end = index + plus;
        if (
          lastRelevantChild.type !== NodeType.ForStatement &&
          lastRelevantChild.args &&
          parent.args
        ) {
          endCtx = CLOSE_BLOCK;
          lastRelevantChild.body = parent;
        } else if (parent.args) lastRelevantChild.args = parent;
        else if (parent.body) lastRelevantChild.body = parent;
        if (lastRelevantChild.type === NodeType.ForStatement) {
          lastRelevantChild.line = line;
          lastRelevantChild.column = column + plus;
          if (parent.semi || !lastRelevantChild.args) {
            lastRelevantChild.type = NodeType.Unknown;
            errorStore.push(
              syntaxError({
                name: "Unterminated",
                msg: "for loop statement",
                line,
                column: column + plus,
                index,
              })
            );
          }
        }
        if (parent.semi || endCtx === CLOSE_BLOCK) {
          ctx.lastRelevantChild = undefined;
        }
      } else {
        (ctx.parent.body as Node[]).push(parent);
      }
      endCtx = undefined;
      index++;
      continue;
    }

    if (parenType === NodeType.CallStatement && possibleForStatement) {
      result = parseOpenForStatement(currentChar, token, ctx, parent);
      if (result === 1) {
        index++;
        continue;
      } else if (result !== 0) {
        errorStore.push(
          syntaxError({ line, column, index, ...(result as SyntaxErrorInput) })
        );
        endCtx = CLOSE_CALL;
        continue;
      }
    }

    result = parseOpenDirectiveDeclaration(currentChar, child, token);
    if (result === 1) {
      index++;
      continue;
    } else if (result !== 0) {
      toggleNode({
        ctx,
        child,
        parentBody,
        index,
        line,
        column,
        errorStore,
        ...(result as object),
      } as ToggleNodeInput);
    }

    let childType = ctx.child.type;
    const isUnknown = childType === NodeType.Unknown;

    let isEscaped = false;
    if (currentChar === ESC) {
      escCount++;
    } else if (escCount > 0) {
      isEscaped = escCount % 2 !== 0;
      escCount = 0;
    }

    if (isUnknown) {
      result = parseIsUnknown(
        index,
        line,
        column,
        ctx,
        parenType,
        currentChar,
        bracketLevels
      );
      if (result === 1) {
        endCtx = currentChar as typeof CLOSE_BLOCK | typeof CLOSE_CALL;
        continue;
      } else if (result !== 0) {
        if (!(result as Context).parent)
          toggleNode({
            ctx,
            child,
            parentBody,
            index,
            line,
            column,
            errorStore,
            ...(result as object),
          } as ToggleNodeInput);
        else {
          standbyCtx.push(ctx);
          ctx = result as Context;
          index++;
          continue;
        }
      }
    }

    childType = ctx.child.type;
    result = checkLevels(
      line,
      lastColumn,
      currentChar,
      nextChar,
      childType,
      isNewLine,
      isUnknown,
      isEscaped
    );
    if (result === 1) {
      index++;
      continue;
    } else if (result !== 0) {
      const { plus, error } = result as Partial<ToggleNodeInput>;
      toggleNode({
        ctx,
        child,
        parentBody,
        index,
        line,
        column,
        errorStore,
        ...(result as object),
      } as ToggleNodeInput);
      if (error) {
        errorStore.push(
          syntaxError({ line, column, index, ...(error as SyntaxErrorInput) })
        );
        if (parenType === NodeType.CallStatement) {
          endCtx = CLOSE_CALL;
          continue;
        }
      }
      index += plus ?? 1;
      continue;
    }

    if (parenType === NodeType.CallStatement) {
      parseCallStatement(
        currentChar,
        parent,
        ctx.wantBracket,
        childType,
        token,
        isEscaped
      );
    }
    index++;
  }

  const { child, parent, lastRelevantChild } = ctx;

  errorIfForStatement(errorStore, lastRelevantChild);

  if (child.type !== NodeType.Unknown) {
    errorStore.push(
      syntaxError({
        line: child.line,
        column: child.column,
        index,
        name: "Unterminated",
        msg: getName(child.type),
      })
    );
    toggleNode({
      ctx,
      child,
      type: child.type,
      index,
      line,
      column,
      errorStore,
      parentBody: parent.body as Node[],
      plus: 0,
    });
  }

  if (parent.type !== NodeType.StyleSheet && index >= textEnd)
    errorStore.push(
      syntaxError({
        line: parent.line,
        column: parent.column,
        index,
        name: "Unterminated",
        msg: getName(parent.type),
      })
    );

  return {
    ast: ctx.parent,
    error: errorStore.length > 0 ? errorStore : undefined,
  };
}

const oTemplate = 0;
const oComponent = 1;
type OperationeType = 0 | 1;
type Operation = [OperationeType] | [OperationeType, string, string];

type ReplacesStore = { start: number; end: number; content: string }[];

const tCall = 0;
const tCallCall = 1;
const tBlock = 2;
const tCallBlock = 3;

type DirectiveType = 0 | 1 | 2 | 3;

type Rules = {
  name: string;
  filterType: (type: DirectiveType) => boolean;
  endBlockStart?: boolean;
  operation?: Operation;
}[];

interface Scope {
  [key: string]: Record<string, [string[], string]>;
}

const globalScope: Scope = {};

function processTemplateReplacement(
  template: [string[], string],
  args: string[]
): string {
  const params = template[0];
  const templateStr = template[1];
  return params.length > 0 && args.length > 0
    ? args.reduce(
        (result, arg, index) => result.replaceAll(`$[${params[index]}]`, arg),
        templateStr
      )
    : templateStr;
}

function processTemplate(
  template: [string[], string] | undefined,
  args: string[]
): string | undefined {
  if (!template) return undefined;
  return processTemplateReplacement(template, args);
}

type WalkReplaceData = [string, string] | undefined;

interface ForLoopData {
  contentStore: string[];
  start: number;
  end: number;
  parentWalkReplaceData: WalkReplaceData;
  endOfLoop?: { start: number; end: number; content: string };
}

function walkReplace(text: string, data: WalkReplaceData) {
  if (!data) return text;
  return text.replaceAll(...data);
}

const getContent = (node: Node, text: string) =>
  text
    .slice(
      (node.start as number) + 1,
      (node.end as number) - (node.semi ? 2 : 1)
    )
    .trim();

type WalkCtx = {
  cReplacesStore: ReplacesStore;
  cIndex: number;
  cBody: Node[];
  cScope: Scope;
  cWalkReplaceData: WalkReplaceData;
  cForLoopData: ForLoopData | undefined;
};

function walkDirectiveAST(
  ast: Node,
  text: string,
  replacesStore: ReplacesStore,
  rules: [Rules, Rules],
  weakScope: boolean = false
): void {
  let index = -1;
  let body = ((ast.body as Node)?.body || ast.body) as Node[];
  let end = body.length;
  let scope: Scope = globalScope;
  let walkReplaceData: WalkReplaceData;
  let forLoopData: ForLoopData | undefined;
  const standby: WalkCtx[] = [];
  while (index <= end) {
    index++;
    if (index >= end) {
      if (standby.length < 1) break;
      else {
        const {
          cReplacesStore,
          cIndex,
          cBody,
          cScope,
          cWalkReplaceData,
          cForLoopData,
        } = standby.pop() as WalkCtx;
        if (forLoopData) {
          const { contentStore, start, end, parentWalkReplaceData, endOfLoop } =
            forLoopData as ForLoopData;
          contentStore.push(
            walkReplace(
              walkReplace(
                replacesStore
                  .sort((a, b) => b.start - a.start)
                  .reduce(
                    (result, replace) =>
                      result.slice(0, replace.start - start) +
                      replace.content +
                      result.slice(replace.end - start),
                    text.slice(start, end)
                  )
                  .trim(),
                parentWalkReplaceData
              ),
              walkReplaceData
            )
          );
          if (endOfLoop) {
            endOfLoop.content = contentStore.join("\n");
            cReplacesStore.push(endOfLoop);
          }
        }
        replacesStore = cReplacesStore;
        index = cIndex;
        body = cBody;
        end = body.length;
        scope = cScope;
        walkReplaceData = cWalkReplaceData;
        forLoopData = cForLoopData;
        continue;
      }
    }
    const node = body[index] as Node;
    if (node.type === NodeType.ForStatement) {
      const argsNode = node.args as Node;
      const key = `$[${walkReplace(argsNode.id as string, walkReplaceData)}]`;
      const contentStore: string[] = [];
      const args = argsNode.args as string[];
      const nodeCodeBlock = node.body as Node;
      const nodeStart = (nodeCodeBlock.start as number) + 1;
      const nodeEnd = (nodeCodeBlock.end as number) - 1;
      const parentWalkReplaceData = walkReplaceData;
      if ((nodeCodeBlock.body as Node[]).length > 0) {
        args.forEach((val, i) => {
          standby.push({
            cReplacesStore: replacesStore,
            cIndex: index,
            cBody: body,
            cScope: scope,
            cWalkReplaceData: walkReplaceData,
            cForLoopData: forLoopData,
          });
          replacesStore = [];
          index = -1;
          body = nodeCodeBlock.body as Node[];
          end = body.length;
          if (!weakScope) {
            const newScope: Scope = {};
            for (const [key, value] of Object.entries(scope)) {
              newScope[key] = { ...value };
            }
            scope = newScope;
          }
          walkReplaceData = [key, walkReplace(val, walkReplaceData)];
          forLoopData = {
            contentStore,
            start: nodeStart,
            end: nodeEnd,
            parentWalkReplaceData,
          };
          if (0 === i) {
            forLoopData.endOfLoop = {
              start: node.start as number,
              end: node.end as number,
              content: "",
            };
          }
        });
      }
      continue;
    }
    if (node.type === NodeType.DirectiveDeclaration && node.id && node.name) {
      const start = node.start;
      const nodeEnd = node.end;
      const nodeId = walkReplace(node.id, walkReplaceData);
      const nodeName = walkReplace(node.name, walkReplaceData);
      let bockStart = -1;
      let type = -1;
      let callContent = "";
      let blockContent = "";
      let args: string[] = [];
      if (node.body && node.args) {
        const blockNode = node.body as Node;
        type = blockNode.args ? tCallCall : tCallBlock;
        const argsNode = node.args as Node;
        args = argsNode.args as string[];
        bockStart = blockNode.start as number;
        callContent = getContent(argsNode, text);
        blockContent = getContent(blockNode, text);
      } else if (node.body) {
        type = tBlock;
        const blockNode = node.body as Node;
        bockStart = blockNode.start as number;
        blockContent = getContent(blockNode, text);
      } else if (node.args) {
        type = tCall;
        const argsNode = node.args as Node;
        args = argsNode.args as string[];
        callContent = getContent(argsNode, text);
      }
      if (type !== -1) {
        const [setters, getters] = rules;
        if (!scope[nodeName]) scope[nodeName] = {};
        const store = scope[nodeName];
        setters.forEach(({ name, filterType }) => {
          if (!filterType(type as DirectiveType) || nodeName !== name) return;
          if (blockContent) {
            store[nodeId] = [args, blockContent];
          } else if (callContent) {
            store[nodeId] = [args, callContent];
          }
          replacesStore.push({
            start: start as number,
            end: nodeEnd as number,
            content: "",
          });
        });
        getters.forEach(
          ({ name, filterType, operation, endBlockStart = false }) => {
            if (!filterType(type as DirectiveType) || nodeName !== name) return;
            const end = endBlockStart ? bockStart : nodeEnd;
            if (operation) {
              if (operation[0] === oTemplate) {
                const result = processTemplate(store[nodeId], args);
                if (result) {
                  replacesStore.push({
                    start: start as number,
                    end: end as number,
                    content: result,
                  });
                }
              } else if (operation[0] === oComponent) {
                const variantName = operation[1] as string;
                const variantContent = operation[2] as string;
                const resultVariant = processTemplate(
                  scope[variantName]?.[nodeId],
                  args
                );
                const resultContent = processTemplate(
                  scope[variantContent]?.[nodeId],
                  args
                );
                if (resultVariant && resultContent) {
                  replacesStore.push({
                    start: start as number,
                    end: end as number,
                    content: `${resultVariant} {${resultContent}}`,
                  });
                }
              }
            }
          }
        );
      }
    }
    const tryBody = ((node.body as Node)?.body || node.body) as Node[];
    if (tryBody && tryBody.length && tryBody.length > 0) {
      standby.push({
        cReplacesStore: replacesStore,
        cIndex: index,
        cBody: body,
        cScope: scope,
        cWalkReplaceData: walkReplaceData,
        cForLoopData: forLoopData,
      });
      index = -1;
      body = tryBody;
      end = body.length;
      if (!weakScope) {
        const newScope: Scope = {};
        for (const [key, value] of Object.entries(scope)) {
          newScope[key] = { ...value };
        }
        scope = newScope;
      }
      forLoopData = undefined;
    }
  }
}

function createCodeFrame(code: string, loc: { line: number; column: number }) {
  const linesAbove = 2,
    linesBelow = 2;
  const lines = code.split("\n");

  const startLine = Math.max(0, loc.line - 1 - linesAbove);
  const endLine = Math.min(lines.length, loc.line + linesBelow);
  const maxLineNumberWidth = String(endLine).length;

  let frame = "";

  for (let i = startLine; i < endLine; i++) {
    const lineNumber = i + 1;
    const isWithinError = i === loc.line - 1;
    const prefix = isWithinError ? "> " : "  ";
    const paddedLineNumber = String(lineNumber).padStart(
      maxLineNumberWidth,
      " "
    );

    frame += `${prefix}${paddedLineNumber} | ${lines[i]}\n`;

    if (isWithinError) {
      frame += `  ${" ".repeat(maxLineNumberWidth)} | ${" ".repeat(
        loc.column - 1
      )}^\n`;
    }
  }

  return frame;
}

function errorFormatter(error: SyntaxError[], code: string) {
  let result = "";
  error.forEach(({ message, loc }) => {
    const codeFrame = createCodeFrame(code, loc);
    result += `${message}\n${codeFrame}\n`;
  });
  return result;
}

function transform(
  text: string,
  weakScope: boolean = false
): { code: string; error?: string; ast?: Node } {
  const replacesStore: ReplacesStore = [];
  const input = text;

  const ctx = parse(input);

  const rulesSet: Rules = [
    {
      name: "template-content",
      filterType: (type) => type === tCallBlock || type === tBlock,
    },
    {
      name: "template-variant",
      filterType: (type) => type === tCall || type === tCallCall,
    },
  ];

  const rulesGet: Rules = [
    {
      name: "template-content",
      filterType: (type) => type === tCall,
      operation: [oTemplate],
    },
    {
      name: "template-variant",
      filterType: (type) => type === tCallBlock || type === tBlock,
      endBlockStart: true,
      operation: [oTemplate],
    },
    {
      name: "template-component",
      filterType: (type) => type === tCall,
      operation: [oComponent, "template-variant", "template-content"],
    },
  ];

  walkDirectiveAST(
    ctx.ast,
    text,
    replacesStore,
    [rulesSet, rulesGet],
    weakScope
  );

  const sortedReplaces = replacesStore.sort((a, b) => b.start - a.start);
  const r: { code: string; error?: string; ast?: Node } = {
    code:
      sortedReplaces
        .reduce(
          (result, replace) =>
            result.slice(0, replace.start) +
            replace.content +
            result.slice(replace.end),
          input
        )
        .trim() + "\n",
  };
  if (ctx.error) r.error = errorFormatter(ctx.error, text);
  return r;
}

import { SourceCodeTransformer } from "unocss";
import { cssIdRE } from "@unocss/core";

interface Opitions {
  weakScope?: boolean;
  showErrors?: boolean;
}

export default function transformTemplate(
  opitions: Opitions = {
    weakScope: false,
    showErrors: false,
  }
): SourceCodeTransformer {
  return {
    name: "unocss-transformer-template",
    enforce: "pre",
    idFilter: (id) => cssIdRE.test(id),
    async transform(code) {
      const original = code.original;
      const result = transform(original, opitions?.weakScope);
      if (opitions?.showErrors && result.error) console.error(result.error);
      code.update(0, original.length, result.code);
    },
  };
}
