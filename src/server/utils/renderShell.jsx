/*
 * Copyright 2020 American Express Travel Related Services Company, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import React from 'react';
import ReactDOM from 'react-dom/server';

// a helper RegExp to modify how we use React to render attribute tags
const templateDataAttrsPattern = /data-attrs="([{}A-Z_]*)"(>)/g;
// a RegExp used for cleaning the final output of any unused/unreplaced tags.
const templateTagPattern = /\s*?({{{[A-Z_]{1,}}}})\s*?/g;

// Tags are used to anchor a string literal with specific purpose in an HTML document
// which will be replaced by match.
const templateTags = {
  doctype: '{{{DOC_TYPE}}}',
  appHtml: '{{{APP_HTML}}}',
  lang: '{{{LANG}}}',
  htmlAttrs: '{{{HTML_ATTRS}}}',
  headAttrs: '{{{HEAD_ATTRS}}}',
  bodyAttrs: '{{{BODY_ATTRS}}}',
  rootAttrs: '{{{ROOT_ATTRS}}}',
  head: '{{{HEAD}}}',
  title: '{{{DOCUMENT_TITLE}}}',
  base: '{{{BASE_TAG}}}',
  meta: '{{{META}}}',
  manifest: '{{{MANIFEST}}}',
  links: '{{{LINKS}}}',
  styles: '{{{STYLE_TAGS}}}',
  initialState: '{{{INITIAL_STATE}}}',
  scripts: '{{{SCRIPT_TAGS}}}',
  headScripts: '{{{HEAD_SCRIPT_TAGS}}}',
  noScripts: '{{{NO_SCRIPT_TAGS}}}',
};

// The template composes the tags and renders the string literals for replacement
// at a specific placement.
const templateString = [templateTags.doctype, ReactDOM.renderToStaticMarkup(
  <html lang={templateTags.lang} data-attrs={templateTags.htmlAttrs}>
    <head data-attrs={templateTags.headAttrs}>
      {templateTags.head}
      {templateTags.title}
      {templateTags.base}
      {templateTags.meta}
      {templateTags.manifest}
      {templateTags.links}
      {templateTags.styles}
      {templateTags.headScripts}
    </head>
    <body data-attrs={templateTags.bodyAttrs}>
      <div data-attrs={templateTags.rootAttrs}>
        {templateTags.appHtml}
      </div>
      {templateTags.initialState}
      {templateTags.scripts}
      {templateTags.noScripts}
    </body>
  </html>
  // we want to replace `data-attrs` from `data-attrs={templateTags.someTag}>` with
  // the two capture groups that target the actual tag and the last `>` in the sequence
).replace(templateDataAttrsPattern, '$1$2')].join('');

// we need to ensure all template presets are functions
// these functions are called if a replacement value is missing
const templatePresets = {
  doctype: () => '<!DOCTYPE html>',
  lang: () => 'en-US',
  rootAttrs: () => 'id="root"',
  title: (title = 'One App') => `<title>${title}</title>`,
  manifest: (href, cors) => (href ? `<link rel="manifest" href="${href}"${cors ? ' crossorigin="use-credentials"' : ''}>` : ''),
};

export function setPreset(tag, fn) {
  // we want to set a preset only if it corresponds with the defined template tags
  if (tag in templateTags) {
    if (typeof fn === 'function') templatePresets[tag] = fn;
    else if (fn === null) delete templatePresets[tag];
  }
}

export function renderPreset(tag, params) {
  // if params is equal to null, we do nothing
  if (tag in templatePresets && params !== null) {
    // can use params as a single value or an array of params
    return templatePresets[tag].apply(null, [].concat(params));
  }
  return null;
}

export function renderGenericHtmlTag(tagName = 'div', attrs = [], body = '') {
  // a generic method to put together an html tag
  return `<${tagName}${[
    attrs.length > 0 ? ' ' : '',
    attrs.join(' ').trim(),
  ].join('')}>${body}</${tagName}>`;
}

export function renderShell(replacements = {}, presets = {}, transforms = []) {
  const html = Object.keys(templateTags)
    // we initially map the template tags and their replacement values
    .map((key) => [
      // the tag {{{ID_TAG}}}
      templateTags[key],
      // value to replace the tag - if no value present
      // we fallback on a preset if it was not nullified
      replacements[key] || renderPreset(key, presets[key]),
    ])
    // we remove anything not a string at this point
    .filter(([, value]) => typeof value === 'string')
    // we replace the tag with value
    .reduce(
      (markup, [tag, value]) => markup.replace(tag, value.trim()),
      templateString
    )
    // we clean up the string of any remaining raw tags and any spacing near them
    .replace(templateTagPattern, '');

  // if we need to do more than replace tags with string values
  // we can transform/validate the final markup with transform functions
  if (Array.isArray(transforms) && transforms.length > 0) {
    return transforms.reduce((markup, transformer) => transformer(markup) || markup, html);
  }

  return html;
}
