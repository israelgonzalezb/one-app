/*
 * Copyright 2019 American Express Travel Related Services Company, Inc.
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

// This rule is only needed for a couple functions below
/* eslint-disable es/no-arrow-functions */
import { matchesUA } from 'browserslist-useragent';
import { browserList } from 'babel-preset-amex/browserlist';

import { setConfig } from '../../universal/ducks/config';
import { getClientStateConfig } from '../utils/stateConfig';
import renderModuleStyles from '../utils/renderModuleStyles';
import { renderHtmlDocument } from '../utils/renderHtmlDocument';

const nodeEnvIsDevelopment = process.env.NODE_ENV === 'development';

export function safeSend(res, ...payload) {
  if (!res.headersSent) {
    res.send(...payload);
  }
}

export function renderStaticErrorPage(res) {
  if (!res.statusCode) {
    res.status(500);
  }
  console.info(`renderStaticErrorPage status ${res.statusCode}`);

  let message = 'Sorry, we are unable to load this page at this time. Please try again later.';
  if (res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 404) {
    // issue is with the request, retrying won't change the server response
    message = 'Sorry, we are unable to load this page at this time.';
  }

  // TODO: allow tenant to provide custom error message and override default html
  safeSend(res,
    `<!DOCTYPE html>
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
        </html>`);
}

export function renderPartial({
  html: initialHtml,
  store,
}) {
  let html = initialHtml;
  // The partial route is commonly used for HTML partials, however email rendering requires
  // generating the entire document (including the <!doctype>), not just a portion of a document.
  // As Fragments cannot use dangerouslySetInnerHTML an outer element is required, but not desired.
  // In the final content body, we use `<dangerously-return-only-doctype>`.
  if (
    initialHtml.match(/^<dangerously-return-only-doctype>\s*<!doctype html>/)
    && initialHtml.match(/<\/html>\s*<\/dangerously-return-only-doctype>$/)
  ) {
    html = initialHtml
      .replace(/^<dangerously-return-only-doctype>/, '')
      .replace(/<\/dangerously-return-only-doctype>$/, '');
  }

  const styles = renderModuleStyles(store);

  if (html.startsWith('<!doctype html>')) {
    return html.replace('</head>', `${styles}</head>`);
  }

  return styles + html;
}

// TODO add additional client side scripts
export default function sendHtml(req, res) {
  let body;
  try {
    const {
      appHtml, store, headers, helmetInfo = {},
    } = req;
    const { scriptNonce } = res;
    const userAgent = headers['user-agent'];
    const isLegacy = !matchesUA(userAgent, {
      browsers: browserList,
      allowHigherVersions: true,
    });

    console.info(`sendHtml, have store? ${!!store}, have appHtml? ${!!appHtml}`);
    if (appHtml && typeof appHtml !== 'string') {
      throw new Error(`appHtml was not a string, was ${typeof appHtml}`, appHtml);
    }
    // replace server specific config with client specific config (api urls and such)
    const clientConfig = getClientStateConfig();
    store.dispatch(setConfig(clientConfig));

    const clientInitialState = store.getState();
    const renderPartialOnly = clientInitialState.getIn(['rendering', 'renderPartialOnly']);

    if (renderPartialOnly) {
      return safeSend(res, renderPartial({ html: req.appHtml, store }));
    }

    body = renderHtmlDocument({
      isStatic: false,
      isDevelopment: nodeEnvIsDevelopment,
      bundleType: isLegacy ? 'legacy' : 'browser',
      store,
      appHtml,
      helmetInfo,
      scriptNonce,
    });
  } catch (err) {
    console.error('sendHtml had an error, sending static error page', err);
    return renderStaticErrorPage(res);
  }

  return safeSend(res, body);
}
