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

import path from 'path';

import readJsonFile from './readJsonFile';

const baseBuildPath = 'app';
const appAssets = (function prepareAppAssets() {
  // to have the variables below garbage collected and removed from memory, we derive the data
  // needed from these variables and do not point to them for any reference beyond this block
  const buildMeta = new Map(Object.entries(readJsonFile('../../../.build-meta.json')));
  const integrityManifest = new Map(Object.entries(readJsonFile('../../../bundle.integrity.manifest.json')));

  const appVersion = buildMeta.get('buildVersion');
  // since we are unsure of the base cdn href, we rely on `path` module
  // instead of `url` module to resolve and join parts of the url path
  const appBuildPath = path.join(baseBuildPath, appVersion);

  // although the legacy bundle is identical to the modern browser bundle,
  // future changes to the bundle may not guarantee this scenario and we continue
  // to separate them in the event that they diverge
  const [modernBrowserChunkAssets, legacyBrowserChunkAssets] = [
    'modernBrowserChunkAssets',
    'legacyBrowserChunkAssets',
  ].map((assetChunkGroupName) => Object.entries(buildMeta.get(assetChunkGroupName))
    .filter(
      ([chunkName]) => chunkName.startsWith('i18n') === false
    )
    // since we rely on the alphabetical order per bundle type
    // we keep the values in an array and preserve the order
    .map(([name, assets]) => {
      // in development, assets is an array with the script url and source map
      // otherwise, we can expect it to be a string value
      let resourcePath = (typeof assets === 'string' ? assets : assets[0]);
      // with the second argument in the mapped array being equal to legacy
      // or not, we can use this to build the path
      if (assetChunkGroupName.startsWith('legacy')) resourcePath = path.join('legacy', resourcePath);
      return [name, {
        src: resourcePath,
        integrity: integrityManifest.get(resourcePath),
      }];
    })
  );

  const i18nFiles = new Map(
    // while browser bundles may differ in the future, the use of `lean-intl`
    // can guarantee that we have the same source files used with the appropriate
    // transforms and runtime helpers added to the legacy version
    Object.entries(buildMeta.get('modernBrowserChunkAssets'))
      .filter(
        ([chunkName]) => chunkName.startsWith('i18n')
      )
      .map(([name, assets]) => {
        // as with the other asset chunks, if in development or in the event that
        // a source map is associated with a resource, we can expect the primary
        // resource path as the first element in the array
        const resourcePath = (typeof assets === 'string' ? assets : assets[0]);
        // since no integrity is associated with an intl file
        // we can use the resourcePath as the only value to use
        // we replace i18n from the name so we can look up a give
        // resource directly by its locale
        return [name.replace('i18n/', ''), resourcePath];
      })
  );

  return {
    version: appVersion,
    publicPath: appBuildPath,
    browser: modernBrowserChunkAssets,
    legacy: legacyBrowserChunkAssets,
    i18n: i18nFiles,
  };
}());

export const defaultCDNUrl = '/_/static';
export const defaultBundleType = 'browser';
export const defaultLocale = 'en-US';

export function getBundleTypeKey(bundleType = defaultBundleType) {
  // we use this key to get only the relevant slice of the client module map
  // and get the resource information for a given module
  return bundleType === 'legacy' ? 'legacyBrowser' : bundleType;
}

export function getAppPublicPath(cdnUrl = defaultCDNUrl) {
  // to set the correct `__webpack_public_path__`,
  // we concatenate the buildPath with the given cdnUrl
  return cdnUrl.concat(cdnUrl.endsWith('/') ? '' : '/', appAssets.publicPath);
}

export function getAppResourceFiles({
  bundleType = defaultBundleType, cdnUrl = defaultCDNUrl,
} = {}) {
  return appAssets[bundleType].map(([, { integrity, src }]) => ({
    integrity,
    // since the cdnUrl is not guaranteed to be an absolute url (eg '/_/static', '/cdn/')
    // we refrain from using the `url` module since it requires a base for constructing
    // and does not resolve with a relative path correctly - path.(join|resolve) likewise
    // does not correctly fuse the two elements when the cdnUrl
    // is a valid (non-filesystem) path (eg 'https://...')
    url: [getAppPublicPath(cdnUrl), src].join('/'),
  }));
}

export function getI18nFileFromLocale({
  locale = defaultLocale, bundleType = defaultBundleType, cdnUrl = defaultCDNUrl,
} = {}) {
  let url = appAssets.i18n.get(locale);
  // in the event that the exact locale is not found, we go through each part
  // of the locale and piece them together in search of a match
  if (!url) {
    // adapted from one-app-ducks src/intl/index.js getLocalePack()
    const localeArray = locale.split('-');
    while (localeArray.length > 0) {
      const nextLocale = localeArray.join('-');
      if (appAssets.i18n.has(nextLocale)) {
        url = appAssets.i18n.get(nextLocale);
        break;
      }
      localeArray.pop();
    }
    // if no match is found, we return null to inform our renderer that no intl file
    // exists for the given locale or from any combination derived from it
    if (!url) return null;
  }
  // since we do not bundle a legacy set, we would need to interject
  // with the correct path to the legacy bundle, otherwise we keep it as it is
  const bundlePath = bundleType === 'legacy' ? url.replace('i18n', `${bundleType}/i18n`) : url;
  return {
    url: [getAppPublicPath(cdnUrl), bundlePath].join('/'),
  };
}
