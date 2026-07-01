/**
 * WebdriverIO config used exclusively for the demo video recording.
 * Extends the base wdio.conf.ts but runs only the demo spec.
 */
import type { Options } from '@wdio/types';
import { config as base } from './wdio.conf';

export const config: Options.Testrunner = {
  ...(base as Options.Testrunner),
  specs: ['./e2e/videos/demo-recording.spec.ts'],
  exclude: [],
};
