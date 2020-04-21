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
  defaultCDNUrl,
} from '../../../src/server/utils/getAppResourceFiles';
import readJsonFile from '../../../src/server/utils/readJsonFile';

const { buildVersion } = readJsonFile('../../../.build-meta.json');
const bundleIntegrity = readJsonFile('../../../bundle.integrity.manifest.json');

describe('getBundleTypeKey', () => {
  test('returns the appropriate key based on bundleType', () => {
    expect(getBundleTypeKey()).toEqual('browser');
    expect(getBundleTypeKey('browser')).toEqual('browser');
    expect(getBundleTypeKey('legacy')).toEqual('legacyBrowser');
  });
});

describe('getAppPublicPath', () => {
  test('returns the complete publicPath based on the given cdnUrl', () => {
    const appBase = '/app/'.concat(buildVersion);
    expect(getAppPublicPath()).toEqual(defaultCDNUrl.concat(appBase));
    expect(getAppPublicPath('/')).toEqual(appBase);
    expect(getAppPublicPath('/_/static')).toEqual('/_/static'.concat(appBase));
    expect(getAppPublicPath('https://example.com/cdn')).toEqual('https://example.com/cdn'.concat(appBase));
  });
});

describe('getAppResourceFiles', () => {
  test('returns modern browser bundle type and default cdnUrl without arguments and in alphabetical order', () => {
    expect(getAppResourceFiles()).toEqual([
      {
        integrity: `${bundleIntegrity['app.js']}`,
        url: `${defaultCDNUrl}/app/${buildVersion}/app.js`,
      },
      {
        integrity: `${bundleIntegrity['app~vendors.js']}`,
        url: `${defaultCDNUrl}/app/${buildVersion}/app~vendors.js`,
      },
      {
        integrity: `${bundleIntegrity['runtime.js']}`,
        url: `${defaultCDNUrl}/app/${buildVersion}/runtime.js`,
      },
      {
        integrity: `${bundleIntegrity['vendors.js']}`,
        url: `${defaultCDNUrl}/app/${buildVersion}/vendors.js`,
      },
    ]);
  });

  test('returns legacy bundle type and uses the provided cdnUrl in alphabetical order', () => {
    const cdnUrl = 'https://cdn.example.com';
    const bundleType = 'legacy';
    expect(getAppResourceFiles({ bundleType, cdnUrl })).toEqual([
      {
        integrity: `${bundleIntegrity[`${bundleType}/app.js`]}`,
        url: `${cdnUrl}/app/${buildVersion}/${bundleType}/app.js`,
      },
      {
        integrity: `${bundleIntegrity[`${bundleType}/app~vendors.js`]}`,
        url: `${cdnUrl}/app/${buildVersion}/${bundleType}/app~vendors.js`,
      },
      {
        integrity: `${bundleIntegrity[`${bundleType}/runtime.js`]}`,
        url: `${cdnUrl}/app/${buildVersion}/${bundleType}/runtime.js`,
      },
      {
        integrity: `${bundleIntegrity[`${bundleType}/vendors.js`]}`,
        url: `${cdnUrl}/app/${buildVersion}/${bundleType}/vendors.js`,
      },
    ]);
  });
});

describe('getI18nFileFromLocale', () => {
  test('gets the default locale using the default bundle type', () => {
    expect(getI18nFileFromLocale()).toEqual({
      url: `/_/static/app/${buildVersion}/i18n/en-US.js`,
    });
  });

  test('gets the default locale using the default bundle type and uses the given cdnUrl', () => {
    const cdnUrl = 'https://example.com/cdn';
    expect(getI18nFileFromLocale({ cdnUrl })).toEqual({
      url: `${cdnUrl}/app/${buildVersion}/i18n/en-US.js`,
    });
  });

  test('gets the default locale by bundle type', () => {
    const bundleType = 'legacy';
    expect(getI18nFileFromLocale({ bundleType })).toEqual({
      url: `/_/static/app/${buildVersion}/${bundleType}/i18n/en-US.js`,
    });
  });

  test('gets the base language from an unrecognized country', () => {
    const locale = 'en-RANDOM';
    expect(getI18nFileFromLocale({ locale })).toEqual({
      url: `/_/static/app/${buildVersion}/i18n/${locale.split('-').shift()}.js`,
    });
  });

  test('returns null if no matches were able to be made', () => {
    const locale = 'zz-ASHFUIASFG';
    expect(getI18nFileFromLocale({ locale })).toBe(null);
  });

  const locales = ['en-XA', 'en-XB', 'zh-TW', 'en-BH', 'es-ES', 'nb-NO', 'nl-NL', 'nl-BE'];

  locales.forEach((locale) => {
    test(`has an intl file for locale '${locale}'`, () => {
      const localeFile = getI18nFileFromLocale({ locale });
      expect(localeFile.url).toMatch(/i18n\/[a-z\d-]+\.js$/i);
    });
  });
});
