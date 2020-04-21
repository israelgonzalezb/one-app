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

import { fromJS } from 'immutable';
import uuid from 'uuid/v4';

import serializeClientInitialState from '../../../src/server/utils/serializeClientInitialState';
import readJsonFile from '../../../src/server/utils/readJsonFile';
import { getClientModuleMapCache } from '../../../src/server/utils/clientModuleMapCache';
import { defaultCDNUrl, defaultLocale, defaultBundleType } from '../../../src/server/utils/getAppResourceFiles';

import {
  extractHelmetInfo,
  orderModules,
  renderHtmlDocument,
} from '../../../src/server/utils/renderHtmlDocument';

jest.mock('../../../src/server/utils/readJsonFile');
jest.mock('../../../src/server/utils/clientModuleMapCache');
jest.mock('uuid/v4', () => jest.fn(() => '19219fb1-8768-4ffa-983c-742b3608589b'));
jest.mock('holocron', () => ({
  getModule: jest.fn(() => {
    const module = () => 0;
    const getFullSheet = jest.fn(() => '.class { background: red; }');
    module.ssrStyles = { getFullSheet };
    return module;
  }),
}));

function createInitialStateMock({
  cdnUrl = defaultCDNUrl,
  activeLocale = defaultLocale,
  rootModuleName = 'test-root',
  modules = ['a', 'b', 'c'],
  disableScripts = false,
  disableStyles = false,
} = {}) {
  return fromJS({
    config: {
      rootModuleName,
      cdnUrl,
    },
    intl: { activeLocale },
    holocron: {
      loaded: [rootModuleName].concat(modules),
    },
    rendering: {
      disableStyles,
      disableScripts,
    },
  });
}

function createHelmetInfoMock(keyValueMap = {}) {
  return Object.entries(keyValueMap).reduce((helmetInfo, [nextKey, nextValue]) => ({
    ...helmetInfo,
    [nextKey]: jest.isMockFunction(nextValue)
      ? { toString: nextValue }
      : { toString: jest.fn(() => nextValue) },
  }), {});
}

describe('renderHtmlDocument', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  const { buildVersion } = readJsonFile('../../../.build-meta.json');
  const bundleIntegrity = readJsonFile('../../../bundle.integrity.manifest.json');
  const store = {
    getState: jest.fn(() => createInitialStateMock()),
  };

  test('fails without the store', () => {
    expect(() => renderHtmlDocument()).toThrow();
    expect(() => renderHtmlDocument({ store })).not.toThrow();
    expect(renderHtmlDocument({ store })).toMatchSnapshot();
  });

  test('renders html document with `appHtml` and `clientInitialState` values', () => {
    const initialState = createInitialStateMock({ activeLocale: 'fr-CA' });
    store.getState.mockImplementationOnce(() => initialState);
    const bundleType = 'browser';
    const clientInitialState = JSON.stringify(serializeClientInitialState(initialState));
    const clientModuleMap = JSON.stringify(getClientModuleMapCache()[bundleType]);
    const appHtml = '<p>Salut!</p>';
    const html = renderHtmlDocument({ store, appHtml });
    expect(html).toMatchSnapshot();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="fr-CA">');
    expect(html).toContain('<title>One App</title>');
    expect(html).toContain(`<div id="root">${appHtml}</div>`);
    expect(html).toContain('<script id="initial-state">');
    expect(html).toContain("window.__render_mode__ = 'hydrate';");
    expect(html).toContain(`window.__webpack_public_path__ = '${defaultCDNUrl}/app/${buildVersion}/';`);
    expect(html).toContain(`window.__holocron_module_bundle_type__ = '${bundleType}';`);
    expect(html).toContain(`window.__CLIENT_HOLOCRON_MODULE_MAP__ = ${clientModuleMap}`);
    expect(html).toContain(`window.__INITIAL_STATE__ = ${clientInitialState};`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/runtime.js" integrity="${bundleIntegrity['runtime.js']}" crossorigin="anonymous"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/vendors.js" integrity="${bundleIntegrity['vendors.js']}" crossorigin="anonymous"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/app~vendors.js" integrity="${bundleIntegrity['app~vendors.js']}" crossorigin="anonymous"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/i18n/fr-CA.js" crossorigin="anonymous"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/app.js" integrity="${bundleIntegrity['app.js']}" crossorigin="anonymous"`);
    expect(html).toContain('test-root.browser.js');
    expect(html).toContain('a.browser.js');
    expect(html).toContain('b.browser.js');
    expect(html).toContain('c.browser.js');
  });

  test('renders html document using `scriptNonce` with "initial-state"', () => {
    const scriptNonce = uuid();
    const html = renderHtmlDocument({ store, scriptNonce });
    expect(html).toMatchSnapshot();
    expect(html).toContain(`<script id="initial-state" nonce="${scriptNonce}">`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/runtime.js"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/vendors.js"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/app~vendors.js"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/i18n/en-US.js"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/app.js"`);
    expect(html).toContain('test-root.browser.js');
    expect(html).toContain('a.browser.js');
    expect(html).toContain('b.browser.js');
    expect(html).toContain('c.browser.js');
  });

  test('renders html document using legacy `bundleType`', () => {
    const html = renderHtmlDocument({ store, bundleType: 'legacy' });
    expect(html).toMatchSnapshot();
    expect(html).toContain('<script id="initial-state">');
    expect(html).toContain('window.__holocron_module_bundle_type__ = \'legacyBrowser\';');
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/legacy/runtime.js"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/legacy/vendors.js"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/legacy/app~vendors.js"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/legacy/i18n/en-US.js"`);
    expect(html).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/legacy/app.js"`);
    expect(html).toContain('test-root.legacy.browser.js');
    expect(html).toContain('a.legacy.browser.js');
    expect(html).toContain('b.legacy.browser.js');
    expect(html).toContain('c.legacy.browser.js');
  });

  test('renders html document targeting static client side rendering', () => {
    const html = renderHtmlDocument({ store, isStatic: true });
    expect(html).toMatchSnapshot();
    expect(html).toContain('window.__render_mode__ = \'render\';');
  });

  test('renders html document in development - does not include integrity on script tags (and pretty prints)', () => {
    const html = renderHtmlDocument({ store, isDevelopment: true });
    expect(html).toMatchSnapshot();
    expect(html).not.toContain('integrity="');
  });

  test('scripts render in order', () => {
    const html = renderHtmlDocument({ store });
    const [appScript,,,, rootScript] = html
      .split('</script>')
      .filter((subString) => subString.startsWith('<script'))
      .reverse();
    expect(appScript).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/app.js"`);
    expect(rootScript).toContain('<script src="https://example.com/cdn/test-root/2.2.2/test-root.browser.js?clientCacheRevision=123"');
  });

  test('script rendering does not include clientCacheRevision on module script tags if not included in clientModuleMap', () => {
    const { [defaultBundleType]: { modules } } = getClientModuleMapCache();
    const clientModuleMap = { [defaultBundleType]: { modules } };
    getClientModuleMapCache.mockImplementationOnce(() => clientModuleMap);
    store.getState.mockImplementationOnce(() => createInitialStateMock({
      modules: [],
    }));

    const html = renderHtmlDocument({ store });
    const [appScript, rootScript] = html
      .split('</script>')
      .filter((subString) => subString.startsWith('<script'))
      .reverse();
    expect(appScript).toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/app.js"`);
    expect(rootScript).toContain('<script src="https://example.com/cdn/test-root/2.2.2/test-root.browser.js"');
  });

  test('script rendering uses the given cdnUrl for app assets', () => {
    const cdnUrl = 'https://main-cdn.example.com';
    store.getState.mockImplementationOnce(() => createInitialStateMock({
      cdnUrl,
    }));
    const html = renderHtmlDocument({ store });
    expect(html).toContain(`<script src="${cdnUrl}/app/${buildVersion}/app.js"`);
    expect(html).toContain('<script src="https://example.com/cdn/test-root/2.2.2/test-root.browser.js?clientCacheRevision=123"');
  });

  test('script rendering omits intl script for missing locale', () => {
    const locale = 'de-DE';
    store.getState.mockImplementationOnce(() => createInitialStateMock({
      activeLocale: locale,
    }));
    const html = renderHtmlDocument({ store });
    expect(html).not.toContain(`<script src="${defaultCDNUrl}/app/${buildVersion}/i18n"`);
  });

  test('renders html document with `helmetInfo`', () => {
    const helmetData = {
      title: '<title>My App Title</title>',
      htmlAttributes: 'htmlAttributes',
      bodyAttributes: 'bodyAttributes',
      meta: '<meta>',
      style: '<style>.style</style>',
      script: '<script>/*script*/</script>',
      link: '<link rel="stylesheet" /><link rel="icon" href="favicon.ico" />',
      base: '<base>',
      noscript: '<noscript>',
    };
    const helmetInfo = createHelmetInfoMock(helmetData);
    const html = renderHtmlDocument({ store, helmetInfo });
    expect(html).toMatchSnapshot();
    Object.entries(helmetData).forEach(([key, value]) => {
      expect(html).toContain(value);
      expect(helmetInfo[key].toString).toHaveBeenCalledTimes(1);
    });
  });

  test('does not render scripts if `rendering.disableScripts` is active', () => {
    store.getState.mockImplementationOnce(() => createInitialStateMock({
      disableScripts: true,
    }));
    const script = '<script />';
    const style = '<style>.class{position: relative;}</style>';
    const link = '<link rel="stylesheet"><link rel="favicon">';
    const helmetInfo = createHelmetInfoMock({ script, style, link });
    const html = renderHtmlDocument({ store, helmetInfo });
    expect(html).toMatchSnapshot();
    expect(html).not.toContain(script);
    expect(html).not.toContain('.js');
    expect(html).not.toContain('window.');
    expect(html).not.toContain('<script');
    expect(html).toContain('rel="favicon"');
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain('<style');
  });

  test('does not render styles if `rendering.disableStyles` is active', () => {
    store.getState.mockImplementationOnce(() => createInitialStateMock({
      disableStyles: true,
    }));
    const style = '<style>.class{position: relative;}</style>';
    const link = '<link rel="stylesheet"><link rel="favicon">';
    const helmetInfo = createHelmetInfoMock({ link, style });
    const html = renderHtmlDocument({ store, helmetInfo });
    expect(html).toMatchSnapshot();
    expect(html).toContain('.js');
    expect(html).toContain('window.');
    expect(html).toContain('<script');
    expect(html).toContain('rel="favicon"');
    expect(html).not.toContain('rel="stylesheet"');
    expect(html).not.toContain('<style');
  });

  test('does not render module styles if `rendering.disableStyles` is active nor does it match any links', () => {
    store.getState.mockImplementationOnce(() => createInitialStateMock({
      disableStyles: true,
    }));
    const html = renderHtmlDocument({ store });
    expect(html).toMatchSnapshot();
    expect(html).toContain('.js');
    expect(html).toContain('window.');
    expect(html).toContain('<script');
    expect(html).not.toContain('<style');
  });
});

describe('utilities', () => {
  describe('extractHelmetInfo', () => {
    test('does nothing without arguments', () => {
      expect(extractHelmetInfo()).toEqual({});
    });

    test('accepts different value types', () => {
      const toString = jest.fn(() => 'title');
      expect(extractHelmetInfo({
        meta: '',
        htmlAttributes: 'htmlAttrs',
        title: { toString },
      })).toEqual({ meta: '', title: 'title', htmlAttributes: 'htmlAttrs' });
      expect(toString).toHaveBeenCalledTimes(1);
    });
  });

  describe('orderModules', () => {
    test('returns empty array without arguments', () => {
      expect(orderModules()).toEqual([]);
    });

    test('accepts different value types', () => {
      const root = 'root';
      const modules = ['a', root, 'b', 'c', 'd'];
      expect(orderModules(modules, root)).toEqual([root, 'a', 'b', 'c', 'd']);
    });
  });
});
