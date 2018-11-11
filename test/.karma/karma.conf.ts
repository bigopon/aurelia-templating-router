import * as karma from 'karma';
import * as path from 'path';
import * as webpack from 'webpack';

const BASE_DIR = process.cwd();

export interface IKarmaConfig extends karma.Config, IKarmaConfigOptions {
  transpileOnly?: boolean;
  noInfo?: boolean;
  coverage?: boolean;
  package?: string;
  reporter?: string;
  set(config: any): void;
}

export interface IKarmaConfigOptions extends karma.ConfigOptions {
  webpack: webpack.Configuration;
  coverageIstanbulReporter?: any;
  junitReporter?: any;
  mochaReporter: {
    ignoreSkipped: boolean;
  };
  customLaunchers: any;
  webpackMiddleware: any;
  webpackServer?: {
    noInfo: boolean
  };
}

const commonChromeFlags: string[] = [
  '--no-default-browser-check',
  '--no-first-run',
  '--no-managed-user-acknowledgment-check',
  '--no-pings',
  '--no-sandbox',
  '--no-wifi',
  '--no-zygote',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backing-store-limit',
  '--disable-boot-animation',
  '--disable-breakpad',
  '--disable-cache',
  '--disable-clear-browsing-data-counters',
  '--disable-cloud-import',
  '--disable-component-extensions-with-background-pages',
  '--disable-contextual-search',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-infobars',
  '--disable-translate',
  '--disable-sync'
];

export default function(config: IKarmaConfig) {
  const webpackConfigs = getWebpackConfigs(config);
  const browsers = config.browsers;
  const options: IKarmaConfigOptions = {
    basePath: BASE_DIR,
    frameworks: ['jasmine'],
    files: [
      'test/**/*.spec.ts'
      // 'test/setup.integration.ts'
    ],
    preprocessors: {
      'test/**/*.spec.ts': ['webpack', 'sourcemap']
    },
    webpack: webpackConfigs,
    mime: {
      'text/x-typescript': ['ts']
    },
    // How long in an infinite loop can we affort to wait
    browserDisconnectTimeout: 3500,
    browserNoActivityTimeout: 20000,
    reporters: ['mocha'],
    webpackMiddleware: {
      stats: {
        colors: true,
        hash: false,
        version: false,
        timings: false,
        assets: false,
        chunks: false,
        modules: false,
        reasons: false,
        children: false,
        source: false,
        errors: true,
        errorDetails: true,
        warnings: false,
        publicPath: false
      }
    },
    webpackServer: { noInfo: true },
    browsers: Array.isArray(browsers) && browsers.length > 0 ? browsers : ['Chrome'],
    customLaunchers: {
      ChromeDebugging: {
        base: 'Chrome',
        flags: [
          ...commonChromeFlags,
          '--remote-debugging-port=9333'
        ],
        debug: true
      },
      ChromeHeadlessOpt: {
        base: 'ChromeHeadless',
        flags: [
          ...commonChromeFlags
        ]
      }
    },
    singleRun: false,
    mochaReporter: {
      ignoreSkipped: true
    }
  };

  if (config.coverage) {
    webpackConfigs.module.rules.push({
      enforce: 'post',
      exclude: /(node_modules|\.spec\.ts$)/,
      loader: 'istanbul-instrumenter-loader',
      options: {
        esModules: true,
        produceSourceMap: true
      },
      test: /src[\/\\].+\.ts$/
    });
    options.reporters.push('coverage-istanbul');
    // options.reporters.push('coverage');
    // options.coverageReporter = {
    //   dir: 'coverage/',
    //   reporters: [
    //     { type: 'text-summary' },
    //     { type: 'json' },
    //     { type: 'html' }
    //   ]
    // };
    options.coverageIstanbulReporter = {
      reports: ['html', 'lcovonly', 'text-summary'],
      fixWebpackSourcePaths: true
    };
  }

  config.set(options);
}

function getWebpackConfigs(karmaConfig: IKarmaConfig): webpack.Configuration {
  const { AureliaPlugin } = require('aurelia-webpack-plugin');
  const browsers = karmaConfig.browsers || [];
  return {
    mode: 'development',
    resolve: {
      extensions: ['.ts', '.js'],
      modules: [
        path.resolve(BASE_DIR, 'node_modules')
      ],
      alias: {
        'aurelia-templating-router': path.resolve(BASE_DIR, 'src', 'index'),
        /**
         * Having this project at the same level with aurelia, and uncomment the following line
         * will enable debugging / testing against aurelia-router source for better cross repo development
         */
        // 'aurelia-router': path.resolve(BASE_DIR, '../aurelia-router/src/index'),
        'routes': path.resolve(BASE_DIR, 'test/integration/routes'),
        'pages': path.resolve(BASE_DIR, 'test/app/pages'),
        'bug619': path.resolve(BASE_DIR, 'test/app/bug619'),
        'resources': path.resolve(BASE_DIR, 'test/app/resources')
      }
    },
    // context: path.resolve(BASE_DIR, 'test'),
    context: BASE_DIR,
    devtool: browsers.includes('ChromeDebugging') ? 'eval-source-map' : 'inline-source-map',
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
          options: {
            configFile: path.resolve(BASE_DIR, 'test/tsconfig.json'),
            compilerOptions: {
              ...require('../../tsconfig.json').compilerOptions,
              ...require('../tsconfig.json').compilerOptions
            }
          }
        },
        {
          test: /\.html$/,
          loader: 'html-loader',
          options: {
            attrs: false
          }
        }
      ]
    },
    plugins: [
      new AureliaPlugin({
        aureliaApp: undefined,
        dist: 'es2015',
        // includeAll: path.resolve(BASE_DIR, 'test/integration/routes'),
        aureliaConfig: [
          'defaultBindingLanguage',
          'history',
          'defaultResources',
          'developmentLogging',
          'eventAggregator',
          'router'
        ],
        noWebpackLoader: true
      })
    ]
  };
}
