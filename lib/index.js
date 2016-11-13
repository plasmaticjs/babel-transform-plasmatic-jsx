/* eslint max-len: ["error", 120, 4]*/

import jsx from 'babel-plugin-syntax-jsx';
import * as t from 'babel-types';

const REGEX_TRIM_LINE = /\t/g;
const REGEX_NEW_LINE = /^[ ]+/;
const REGEX_LAST_LINE = /[ ]+$/;
const REGEX_LINE_SPLIT = /\r\n|\n|\r/;

const PLASMATIC_NAMESPACE_IDENTIFIER = 'Plasmatic';
const PLASMATIC_METHOD_LITERAL = 'createLiteral';
const PLASMATIC_METHOD_COMPONENT = 'createComponent';

function createPlasmaticMethod(method) {
  const calle = [PLASMATIC_NAMESPACE_IDENTIFIER, method];
  return calle.map(identifier => t.identifier(identifier))
    .reduce((_method, property) => t.memberExpression(_method, property));
}

function convertExpressionToHTMLTag(expression) {
  if (t.isIdentifier(expression)) {
    return expression.name;
  } else if (t.isLiteral(expression)) {
    return expression.value;
  }

  return null;
}

function convertExpressionToArgs(block) {
  if (!t.isExpression(block.expression)) {
    return [t.stringLiteral(block.HTMLTagName)];
  }

  return [block.expression];
}

function convertAttributeValue(node) {
  // Check if value is some expression {someValue}
  if (t.isJSXExpressionContainer(node)) {
    return node.expression;
  }

  return node;
}

function convertAttributes(attributes) {
  const attrs = attributes.map((attr) => {
    const attribute = attr;
    const value = convertAttributeValue(attr.value || t.booleanLiteral(true));

    // Replace whitespaces in value
    if (t.isStringLiteral(value) && !t.isJSXExpressionContainer(attr.value)) {
      value.value = value.value.replace(/\n\s+/g, ' ');
    }

    // Type is needed as Identifier
    if (t.isValidIdentifier(attr.name.name)) {
      attribute.name.type = 'Identifier';
    } else {
      attribute.name = t.stringLiteral(attr.name.name);
    }

    // Build property of the final object
    return t.objectProperty(attribute.name, value);
  });

  return t.objectExpression(attrs);
}

function buildLiteralWithoutWhitespace(node) {
  const lines = node.value.split(REGEX_LINE_SPLIT);

  let lastNonEmptyLineIndex = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].match(/[^ \t]/)) {
      lastNonEmptyLineIndex = i;
    }
  }

  let str = '';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    let trimmedLine = line.replace(REGEX_TRIM_LINE, ' ');

    if (i === 0) {
      // trim very first line
      trimmedLine = trimmedLine.replace(REGEX_NEW_LINE, '');
    }

    if (i === lines.length - 1) {
      // trim very last line
      trimmedLine = trimmedLine.replace(REGEX_LAST_LINE, '');
    }

    if (trimmedLine) {
      if (i === lastNonEmptyLineIndex) {
        trimmedLine += ' ';
      }

      str += trimmedLine;
    }
  }

  if (str) {
    return t.callExpression(createPlasmaticMethod(PLASMATIC_METHOD_LITERAL), [t.stringLiteral(str)]);
  }

  return false;
}

function buildChildrensTree(node) {
  const childrens = [];
  node.children.forEach((children) => {
    let child = children;

    if (t.isJSXText(children)) {
      child = buildLiteralWithoutWhitespace(children);
    }

    if (t.isJSXEmptyExpression(children)) return;

    if (t.isJSXExpressionContainer(children)) {
      child = children.expression;
    }

    if (child) {
      childrens.push(child);
    }
  });

  return childrens;
}

export default function () {
  const visitor = {};

  visitor.JSXElement = {
    exit: (path) => {
      const jsxTree = path.get('openingElement');
      const parentNode = jsxTree.node;
      const firstNode = parentNode.name;

      const block = {
        expression: firstNode,
        args: [],
        HTMLTagName: '',
        attrs: [],
      };

      // Check types of JSX identifiers
      if (t.isJSXIdentifier(firstNode)) {
        if (firstNode.name === 'this' && t.isReferenced(firstNode, parentNode)) {
          block.expression = t.thisExpression();
        } else {
          block.expression = t.stringLiteral(firstNode.name);
        }
      }

      // FirstNode is now converted to AST expression try to get HTMLTagName and props
      block.attrs = parentNode.attributes;
      block.args = convertExpressionToArgs(block);
      block.HTMLTagName = convertExpressionToHTMLTag(block.expression);

      // We need to convert attribues to objects
      if (block.attrs && block.attrs.length > 0) {
        block.args.push(convertAttributes(block.attrs));
      } else {
        block.args.push(t.nullLiteral());
      }

      // Append childrens
      const childNodes = buildChildrensTree(jsxTree.parent);

      if (childNodes.length > 0) {
        block.args = block.args.concat(childNodes);
      }

      const call = t.callExpression(createPlasmaticMethod(PLASMATIC_METHOD_COMPONENT), block.args);

      if (childNodes.length > 0) {
        call._prettyCall = true; // eslint-disable-line no-underscore-dangle
      }
      path.replaceWith(t.inherits(call, path.node));
    },
  };

  return {
    inherits: jsx,
    visitor,
  };
}
