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

import {
  getBundleTypeKey,
  getAppPublicPath,
  getAppResourceFiles,
  getI18nFileFromLocale,
} from './getAppResourceFiles';
import { getClientModuleMapCache } from './clientModuleMapCache';
import { renderShell, renderGenericHtmlTag } from './renderShell';
import renderModuleStyles from './renderModuleStyles';
import jsonStringifyForScript from './jsonStringifyForScript';
import serializeClientInitialState from './serializeClientInitialState';

export function extractHelmetInfo(helmetInfo) {
  return helmetInfo
    ? Object.entries(helmetInfo)
      .reduce((object, [key, value]) => ({
        ...object,
        [key]: value && typeof value === 'object' ? value.toString() : value || '',
      }), {})
    : {};
}

export function orderModules(modules = [], rootModuleName = '') {
  // Sourced from `renderModuleScripts` (`sendHtml.js`):
  // Sorting to ensure that the rootModule is the first script to load,
  // this is required to correctly provide external dependencies.
  return modules.sort((currentModule, nextModule) => {
    if (currentModule === rootModuleName) { return -1; }
    if (nextModule === rootModuleName) { return 1; }
    return 0;
  });
}

function renderScriptTag(src, attrs, body) {
  // set `src` as the first attribute
  if (src) attrs.unshift(`src="${src}"`);
  return renderGenericHtmlTag('script', attrs, body);
}

function renderInitialState({
  clientInitialState,
  clientModuleMap,
  scriptNonce,
  bundleType,
  cdnUrl,
  isStatic,
  isDevelopment,
}) {
  const initialStateMap = Object.entries({
    // dictates if the client app should start rendering with
    // either ReactDOM method listed below
    __render_mode__: `'${isStatic ? 'render' : 'hydrate'}'`,
    // we expect the cdnUrl = 'https://example.com/cdn' || '/_/static/'
    // and we combine with the buildPath and add a trailing slash
    __webpack_public_path__: `'${getAppPublicPath(cdnUrl)}/'`,
    // we toggle between `browser` and `legacyBrowser` depending on `bundleType`
    __holocron_module_bundle_type__: `'${getBundleTypeKey(bundleType)}'`,
    // The client module map is derived from the original module map and is expected to be
    // stringified here, we do not wrap it in quotes as we want it directly usable
    __CLIENT_HOLOCRON_MODULE_MAP__: clientModuleMap,
    // The client initial state after it has serialized the immutable state and stringified
    __INITIAL_STATE__: clientInitialState,
    // we take all the values and set the key/value pair to the window
  }).map(([key, value]) => `window.${key} = ${value};`);
  return renderScriptTag(
    null,
    ['id="initial-state"', scriptNonce ? `nonce="${scriptNonce}"` : ''],
    // If isDevelopment, we pretty print the body for readability, otherwise we pack together.
    isDevelopment
      ? `\n${initialStateMap
        .map((entry) => `\t${entry}`)
        .join('\n')}\n`
      : initialStateMap.join('')
  );
}

function renderScripts({
  clientModuleMap,
  modules,
  bundleType,
  cdnUrl,
  locale,
  isDevelopment,
}) {
  // There is an alphabetical order to the app assets when we call `getAppResourceFiles`,
  // we can use this order to re-structure the scripts to our needs,
  // as seen in the return statement.
  const [app, appVendors, runtime, vendors] = getAppResourceFiles({ cdnUrl, bundleType })
    .map(({ url, integrity }) => renderScriptTag(
      url, [].concat(isDevelopment ? [] : `integrity="${integrity}"`, 'crossorigin="anonymous"')
    ));
  // We can use `activeLocale` to find i18n file to serve, if none is matched,
  // we do not include the `i18nScript`.
  const i18nFile = getI18nFileFromLocale({ locale, cdnUrl, bundleType });
  const i18nScript = i18nFile ? renderScriptTag(i18nFile.url, ['crossorigin="anonymous"']) : [];
  // Since we expect the `clientModuleMap` from `getClientModuleMapCache`,
  // it is pre-formatted to lookup the `clientModuleMap` by a given `bundleTypeKey`,
  // which will be either `browser` or `legacyBrowser`.
  const bundleTypeKey = getBundleTypeKey(bundleType);
  const moduleMap = clientModuleMap[bundleTypeKey];
  const { clientCacheRevision } = moduleMap;
  // We expect the modules to be already ordered (root module first, unlike the app assets).
  const moduleScripts = modules.map((moduleName) => {
    const { url, integrity } = moduleMap.modules[moduleName][bundleTypeKey];
    return renderScriptTag(
      url.concat(clientCacheRevision ? `?clientCacheRevision=${clientCacheRevision}` : ''),
      [].concat(isDevelopment ? [] : `integrity="${integrity}"`, 'crossorigin="anonymous"')
    );
  });
  // We order all the necessary script tags to run `one-app` client-side.
  return [
    runtime,
    vendors,
    appVendors,
  ].concat(
    i18nScript,
    moduleScripts,
    app
  ).join(isDevelopment ? '\n' : '');
}

export function renderHtmlDocument({
  store,
  appHtml,
  helmetInfo,
  bundleType,
  scriptNonce,
  isStatic,
  isDevelopment,
} = {}) {
  if (!store) throw new Error('store is required to render html document');

  // The goal with `renderHtmlDocument` is state driven rendering, where the
  // client initial state will dictate how the html document is formed/created.
  const clientInitialState = store.getState();
  const {
    config: { rootModuleName, cdnUrl },
    holocron: { loaded },
    intl: { activeLocale },
    rendering: { disableScripts, disableStyles },
  } = clientInitialState.toJS();

  const {
    // We should expect only string values at this point from the `helmetInfo`.
    htmlAttributes, bodyAttributes, base, title, meta, link, style, script, noscript,
  } = extractHelmetInfo(helmetInfo);

  let initialState = null;
  let scripts = null;
  let styles = null;
  let links = null;

  if (!disableStyles) {
    // TODO: replace store param here for the ordered modules
    styles = [style, renderModuleStyles(store)].join('');
    links = link;
  } else {
    // Sourced from `getHelmetString` (`sendHtml.js`):
    // filter only stylesheets
    links = ((link || '').match(/<[^>]+>/g) || [])
      .filter((match) => !match.includes('rel="stylesheet"'))
      .join('');
  }

  if (!disableScripts) {
    // TODO: remove from createRequestStore and place here
    const clientModuleMap = getClientModuleMapCache();
    const modules = orderModules(loaded, rootModuleName);

    scripts = renderScripts({
      clientModuleMap,
      modules,
      bundleType,
      locale: activeLocale,
      cdnUrl,
      isDevelopment,
    }).concat(script || '');
    initialState = renderInitialState({
      isDevelopment,
      isStatic,
      scriptNonce,
      bundleType,
      cdnUrl,
      clientModuleMap: jsonStringifyForScript(clientModuleMap[getBundleTypeKey(bundleType)]),
      clientInitialState: jsonStringifyForScript(serializeClientInitialState(clientInitialState)),
    });
  }

  return renderShell({
    lang: activeLocale,
    appHtml,
    initialState,
    scripts,
    styles,
    links,
    meta,
    base,
    title,
    htmlAttrs: htmlAttributes,
    bodyAttrs: bodyAttributes,
    noScripts: noscript,
  });
}
