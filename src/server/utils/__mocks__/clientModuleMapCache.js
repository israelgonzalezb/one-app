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

const clientModuleMapCache = jest.requireActual('../clientModuleMapCache');

// eslint-disable-next-line no-underscore-dangle
export function _createMockedModuleMap(modulesList = [], { cdnUrl = 'https://example.com/cdn', clientCacheRevision } = {}) {
  const moduleMap = modulesList.map(([moduleName, moduleVersion = '2.2.2']) => {
    const baseModuleUrl = `${cdnUrl}/${moduleName}/${moduleVersion}/${moduleName}`;
    return {
      [moduleName]: {
        node: {
          url: `${baseModuleUrl}.node.js`,
          integrity: moduleName.concat('-abc-123-node'),
        },
        browser: {
          url: `${baseModuleUrl}.browser.js`,
          integrity: moduleName.concat('-abc-123-browser'),
        },
        legacyBrowser: {
          url: `${baseModuleUrl}.legacy.browser.js`,
          integrity: moduleName.concat('-abc-123-legacy'),
        },
      },
    };
  }).reduce(({ modules }, moduleEntry) => ({
    modules: { ...modules, ...moduleEntry },
  }), { modules: {} });

  if (clientCacheRevision) moduleMap.clientCacheRevision = clientCacheRevision;

  return moduleMap;
}

clientModuleMapCache.setClientModuleMapCache(
  _createMockedModuleMap([
    ['test-root'],
    ['a', '2.1.0'],
    ['b', '1.2.2'],
    ['c', '0.1.2'],
  ], {
    clientCacheRevision: '123',
  })
);

export const getClientModuleMapCache = jest.fn(clientModuleMapCache.getClientModuleMapCache);
export const setClientModuleMapCache = jest.fn(clientModuleMapCache.setClientModuleMapCache);
