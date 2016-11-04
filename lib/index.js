import jsx from 'babel-plugin-syntax-jsx';
import * as t from 'babel-types';

function createPlasmaticMethod(method) {
  const calle = ['Plasmatic', method];
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

function buildChildrensTree(node) {
  const childrens = [];
  node.children.forEach((children) => {
    let child = children;

    if (t.isJSXEmptyExpression(children)) return;

    if (t.isJSXExpressionContainer(children)) {
      child = children.expression;
    }

    childrens.push(child);
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

      const call = t.callExpression(createPlasmaticMethod('createComponent'), block.args);
      path.replaceWith(t.inherits(call, path.node));
    },
  };

  return {
    inherits: jsx,
    visitor,
  };
}
