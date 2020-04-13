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

import {
  setPreset,
  renderPreset,
  renderGenericHtmlTag,
  renderShell,
} from '../../../src/server/utils/renderShell';

describe('templatePresets', () => {
  test('renderPreset returns null if preset is not found', () => {
    expect(renderPreset('random-key')).toBe(null);
  });

  test('renderPreset returns null if params is null', () => {
    expect(renderPreset('lang', null)).toBe(null);
  });

  test('setPreset sets a function for a tag preset and deletes it afterwards', () => {
    const tag = 'links';
    const fn = () => '<link rel="favicon" href="favicon.ico"/>';
    expect(setPreset(tag, fn)).toBeUndefined();
    expect(renderPreset(tag)).toEqual(fn());
    expect(setPreset(tag, null)).toBeUndefined();
    expect(renderPreset(tag)).toEqual(null);
  });

  test('setPreset does not set a tag preset if value is not a function', () => {
    const tag = 'links';
    const fn = '<link rel="favicon" href="favicon.ico"/>';
    expect(setPreset(tag, fn)).toBeUndefined();
    expect(renderPreset(tag)).toEqual(null);
  });

  test('setPreset does not set a tag preset if it does not correspond with a tag', () => {
    const tag = 'favicon-string';
    const fn = '<link rel="favicon" href="favicon.ico"/>';
    expect(setPreset(tag, fn)).toBeUndefined();
    expect(renderPreset(tag)).toEqual(null);
  });

  test('title preset returns correct values', () => {
    const title = '/manifest.webmanifest';
    expect(renderPreset('title')).toEqual('<title>One App</title>');
    expect(renderPreset('title', title)).toEqual(`<title>${title}</title>`);
  });

  test('manifest preset returns correct values', () => {
    const href = '/manifest.webmanifest';
    const cors = true;
    expect(renderPreset('manifest')).toEqual('');
    expect(renderPreset('manifest', href)).toEqual(`<link rel="manifest" href="${href}">`);
    expect(renderPreset('manifest', [href, cors])).toEqual(`<link rel="manifest" href="${href}" crossorigin="use-credentials">`);
  });
});

describe('renderGenericHtmlTag', () => {
  test('returns tags based on input', () => {
    expect(renderGenericHtmlTag()).toEqual('<div></div>');
    expect(renderGenericHtmlTag('p')).toEqual('<p></p>');
    expect(renderGenericHtmlTag('p', ['title="my-paragraph"'])).toEqual('<p title="my-paragraph"></p>');
    expect(renderGenericHtmlTag('p', undefined, 'my paragraph body')).toEqual('<p>my paragraph body</p>');
  });
});

describe('renderShell', () => {
  test('renders basic markup without any arguments', () => {
    expect(renderShell()).toMatchSnapshot();
  });

  test('does not render presets when their values are null', () => {
    // lang is a required value that needs to be supplied without preset
    const replacements = { lang: 'en-US' };
    const presets = { title: null, rootAttrs: null, doctype: null };
    expect(renderShell(replacements, presets)).toMatchSnapshot();
  });

  test('renders markup with the standard template using replacements and default presets', () => {
    expect(renderShell(
      {
        appHtml: ReactDOM.renderToString(
          <div>
            <p> rendered string from markup/component </p>
          </div>
        ),
      }
    )).toMatchSnapshot();
  });

  test('renders markup with the standard template using replacements and presets', () => {
    const appHtml = ReactDOM.renderToStaticMarkup(
      <div>
        <p> rendered static string from markup/component </p>
      </div>
    );
    const markup = renderShell(
      {
        lang: 'ca-FR',
        appHtml,
      },
      {
        rootAttrs: null,
        title: 'Node.js App',
        manifest: ['/manifest.webmanifest', true],
      }
    );
    expect(markup).toMatchSnapshot();
    expect(markup).toContain(appHtml);
    expect(markup).toContain('<html lang="ca-FR">');
    expect(markup).toContain('<title>Node.js App</title>');
    expect(markup).toContain('<link rel="manifest" href="/manifest.webmanifest" crossorigin="use-credentials">');
    expect(markup).not.toContain('<div id="root"');
  });

  test('transformers are called and modify the final output in place', () => {
    const docType = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">';
    const transformer = jest.fn((html) => html.replace('<!DOCTYPE html>', docType));
    const transforms = [transformer];
    const markup = renderShell(undefined, undefined, transforms);
    expect(markup).toContain(docType);
    expect(transformer).toHaveBeenCalledTimes(1);
  });

  test('transformers do not replace markup if they return nothing', () => {
    // useful for validation
    const transformer = jest.fn();
    const transforms = [transformer];
    const markup = renderShell(undefined, undefined, transforms);
    expect(markup).toEqual(renderShell());
    expect(transformer).toHaveBeenCalledTimes(1);
  });
});

describe('renderShell Examples', () => {
  test('render static error page', () => {
    const message = 'ERROR';

    const lang = 'en-US';
    const meta = [
      '<meta http-equiv="X-UA-Compatible" content="IE=edge">',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="application-name" content="one-app">',
    ].join('');
    const bodyAttrs = 'style="background-color:#F0F0F0"';
    const appHtml = ReactDOM.renderToStaticMarkup(
      <div>
        <div style={{ width: '70%', backgroundColor: 'white', margin: '4% auto' }}>
          <h2 style={{ display: 'flex', justifyContent: 'center', padding: '40px 15px 0px' }}>Loading Error</h2>
          <p style={{ display: 'flex', justifyContent: 'center', padding: '10px 15px 40px' }}>
            {message}
          </p>
        </div>
      </div>
    );

    const renderErrorStaticPage = () => `<!DOCTYPE html>
        <html>
          <head>
            <title>One App</title>
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="application-name" content="one-app">
          </head>
          <body style="background-color: #F0F0F0">
            <div id="root">
              <div>
                <div style="width: 70%; background-color: white; margin: 4% auto;">
                  <h2 style="display: flex; justify-content: center; padding: 40px 15px 0px;">Loading Error</h2>
                  <p style="display: flex; justify-content: center; padding: 10px 15px 40px;">
                    ${message}
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>`
      // flatten nesting and trim white space between
      .split('\n').map((str) => str.trim()).join('')
      // modify to match the required lang value of shell
      .replace('<html>', `<html lang="${lang}">`)
      // tighten styles attribute to match how react renders
      // style="width:70%;background-color:white;margin:4% auto;"
      .replace(/style="([^<>])*"/g, (match) => match
        // remove spacing between colon and semi-colon
        .replace(/;\s+/g, ';')
        .replace(/:\s+/g, ':')
        // and finally removing the last semi-colon
        .replace(';"', '"')
      );

    expect(renderShell({
      lang,
      meta,
      bodyAttrs,
      appHtml,
    })).toMatchInlineSnapshot(JSON.stringify(renderErrorStaticPage()));
  });
});
