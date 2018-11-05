'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var aureliaDependencyInjection = require('aurelia-dependency-injection');
var aureliaBinding = require('aurelia-binding');
var aureliaTemplating = require('aurelia-templating');
var aureliaRouter = require('aurelia-router');
var aureliaMetadata = require('aurelia-metadata');
var aureliaPal = require('aurelia-pal');
var aureliaPath = require('aurelia-path');
var LogManager = require('aurelia-logging');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var EmptyViewModel = /** @class */ (function () {
    function EmptyViewModel() {
    }
    return EmptyViewModel;
}());
/**
 * Implementation of Aurelia Router ViewPort. Responsible for loading route, composing and swapping routes views
 */
var RouterView = /** @class */ (function () {
    function RouterView(element, container, viewSlot, router, viewLocator, compositionTransaction, compositionEngine) {
        this.element = element;
        this.container = container;
        this.viewSlot = viewSlot;
        this.router = router;
        this.viewLocator = viewLocator;
        this.compositionTransaction = compositionTransaction;
        this.compositionEngine = compositionEngine;
        this.router.registerViewPort(this, this.element.getAttribute('name'));
        if (!('initialComposition' in compositionTransaction)) {
            compositionTransaction.initialComposition = true;
            this.compositionTransactionNotifier = compositionTransaction.enlist();
        }
    }
    /**@internal */
    RouterView.inject = function () {
        return [aureliaPal.DOM.Element, aureliaDependencyInjection.Container, aureliaTemplating.ViewSlot, aureliaRouter.Router, aureliaTemplating.ViewLocator, aureliaTemplating.CompositionTransaction, aureliaTemplating.CompositionEngine];
    };
    RouterView.prototype.created = function (owningView) {
        this.owningView = owningView;
    };
    RouterView.prototype.bind = function (bindingContext, overrideContext) {
        this.container.viewModel = bindingContext;
        this.overrideContext = overrideContext;
    };
    RouterView.prototype.process = function (viewPortInstruction, waitToSwap) {
        var _this = this;
        var component = viewPortInstruction.component;
        var childContainer = component.childContainer;
        var viewModel = component.viewModel;
        var viewModelResource = component.viewModelResource;
        var metadata = viewModelResource.metadata;
        var config = component.router.currentInstruction.config;
        var viewPort = config.viewPorts ? (config.viewPorts[viewPortInstruction.name] || {}) : {};
        childContainer.get(RouterViewLocator)._notify(this);
        // layoutInstruction is our layout viewModel
        var layoutInstruction = {
            viewModel: viewPort.layoutViewModel || config.layoutViewModel || this.layoutViewModel,
            view: viewPort.layoutView || config.layoutView || this.layoutView,
            model: viewPort.layoutModel || config.layoutModel || this.layoutModel,
            router: viewPortInstruction.component.router,
            childContainer: childContainer,
            viewSlot: this.viewSlot
        };
        var viewStrategy = this.viewLocator.getViewStrategy(component.view || viewModel);
        if (viewStrategy && component.view) {
            viewStrategy.makeRelativeTo(aureliaMetadata.Origin.get(component.router.container.viewModel.constructor).moduleId);
        }
        return metadata
            .load(childContainer, viewModelResource.value, null, viewStrategy, true)
            // Wrong typing from aurelia templating
            // it's supposed to be a Promise<ViewFactory>
            .then(function (viewFactory) {
            if (!_this.compositionTransactionNotifier) {
                _this.compositionTransactionOwnershipToken = _this.compositionTransaction.tryCapture();
            }
            if (layoutInstruction.viewModel || layoutInstruction.view) {
                viewPortInstruction.layoutInstruction = layoutInstruction;
            }
            viewPortInstruction.controller = metadata.create(childContainer, aureliaTemplating.BehaviorInstruction.dynamic(_this.element, viewModel, viewFactory));
            if (waitToSwap) {
                return null;
            }
            _this.swap(viewPortInstruction);
        });
    };
    RouterView.prototype.swap = function (viewPortInstruction) {
        var _this = this;
        var layoutInstruction = viewPortInstruction.layoutInstruction;
        var previousView = this.view;
        var work = function () {
            var swapStrategy = aureliaTemplating.SwapStrategies[_this.swapOrder] || aureliaTemplating.SwapStrategies.after;
            var viewSlot = _this.viewSlot;
            swapStrategy(viewSlot, previousView, function () {
                return Promise.resolve(viewSlot.add(_this.view));
            }).then(function () {
                _this._notify();
            });
        };
        var ready = function (owningView) {
            viewPortInstruction.controller.automate(_this.overrideContext, owningView);
            if (_this.compositionTransactionOwnershipToken) {
                return _this.compositionTransactionOwnershipToken
                    .waitForCompositionComplete()
                    .then(function () {
                    _this.compositionTransactionOwnershipToken = null;
                    return work();
                });
            }
            return work();
        };
        if (layoutInstruction) {
            if (!layoutInstruction.viewModel) {
                // createController chokes if there's no viewmodel, so create a dummy one
                layoutInstruction.viewModel = new EmptyViewModel();
            }
            return this.compositionEngine
                .createController(layoutInstruction)
                .then(function (controller) {
                aureliaTemplating.ShadowDOM.distributeView(viewPortInstruction.controller.view, controller.slots || controller.view.slots);
                controller.automate(aureliaBinding.createOverrideContext(layoutInstruction.viewModel), _this.owningView);
                controller.view.children.push(viewPortInstruction.controller.view);
                return controller.view || controller;
            })
                .then(function (newView) {
                _this.view = newView;
                return ready(newView);
            });
        }
        this.view = viewPortInstruction.controller.view;
        return ready(this.owningView);
    };
    /**@internal */
    RouterView.prototype._notify = function () {
        if (this.compositionTransactionNotifier) {
            this.compositionTransactionNotifier.done();
            this.compositionTransactionNotifier = null;
        }
    };
    /**@internal */
    RouterView.$view = null;
    /**@internal */
    RouterView.$resource = {
        name: 'router-view',
        bindables: ['swapOrder', 'layoutView', 'layoutViewModel', 'layoutModel']
    };
    return RouterView;
}());
/**
* Locator which finds the nearest RouterView, relative to the current dependency injection container.
*/
var RouterViewLocator = /** @class */ (function () {
    /**
    * Creates an instance of the RouterViewLocator class.
    */
    function RouterViewLocator() {
        var _this = this;
        this.promise = new Promise(function (resolve) { return _this.resolve = resolve; });
    }
    /**
    * Finds the nearest RouterView instance.
    * @returns A promise that will be resolved with the located RouterView instance.
    */
    RouterViewLocator.prototype.findNearest = function () {
        return this.promise;
    };
    /**@internal */
    RouterViewLocator.prototype._notify = function (routerView) {
        this.resolve(routerView);
    };
    return RouterViewLocator;
}());

var EmptyClass = /** @class */ (function () {
    function EmptyClass() {
    }
    return EmptyClass;
}());
aureliaTemplating.inlineView('<template></template>')(EmptyClass);
var TemplatingRouteLoader = /** @class */ (function (_super) {
    __extends(TemplatingRouteLoader, _super);
    function TemplatingRouteLoader(compositionEngine) {
        var _this = _super.call(this) || this;
        _this.compositionEngine = compositionEngine;
        return _this;
    }
    TemplatingRouteLoader.prototype.loadRoute = function (router, config, _navInstruction) {
        var _this = this;
        var childContainer = router.container.createChild();
        var promise;
        // let viewModel: string | /**Constructable */ Function | null | Record<string, any>;
        if ('moduleId' in config) {
            var viewModel = void 0;
            var moduleId = config.moduleId;
            if (moduleId === null) {
                viewModel = EmptyClass;
            }
            else if (/\.html/i.test(moduleId)) {
                viewModel = createDynamicClass(moduleId);
            }
            else {
                viewModel = aureliaPath.relativeToFile(moduleId, aureliaMetadata.Origin.get(router.container.viewModel.constructor).moduleId);
            }
            promise = Promise.resolve(viewModel);
        }
        else if ('viewModel' in config) {
            // Implementation wise, the router already ensure this is a synchronous call
            // but interface wise it's annoying
            promise = Promise
                .resolve(config.viewModel())
                .then(function (vm) {
                if (typeof vm === 'function') {
                    return vm;
                }
                if (vm && typeof vm === 'object') {
                    // viewModel: () => import('...')
                    return vm.default;
                }
                throw new Error('Invalid view model config');
            });
        }
        else {
            throw new Error('Invalid route config. No "moduleId"/"viewModel" found.');
        }
        return promise
            .then(function (viewModel) {
            var instruction = {
                viewModel: viewModel,
                childContainer: childContainer,
                view: config.view || config.viewStrategy,
                router: router
            };
            childContainer.registerSingleton(RouterViewLocator);
            childContainer.getChildRouter = function () {
                var childRouter;
                childContainer.registerHandler(aureliaRouter.Router, function () {
                    return childRouter || (childRouter = router.createChild(childContainer));
                });
                return childContainer.get(aureliaRouter.Router);
            };
            return _this.compositionEngine.ensureViewModel(instruction);
        });
    };
    /**@internal */
    TemplatingRouteLoader.inject = [aureliaTemplating.CompositionEngine];
    return TemplatingRouteLoader;
}(aureliaRouter.RouteLoader));
function createDynamicClass(moduleId) {
    var name = /([^\/^\?]+)\.html/i.exec(moduleId)[1];
    var DynamicClass = /** @class */ (function () {
        function DynamicClass() {
        }
        DynamicClass.prototype.bind = function (bindingContext) {
            this.$parent = bindingContext;
        };
        return DynamicClass;
    }());
    aureliaTemplating.customElement(name)(DynamicClass);
    aureliaTemplating.useView(moduleId)(DynamicClass);
    return DynamicClass;
}

var logger = LogManager.getLogger('route-href');
/**
 * Helper custom attribute to help associate an element with a route by name
 */
var RouteHref = /** @class */ (function () {
    function RouteHref(router, element) {
        this.router = router;
        this.element = element;
    }
    /*@internal */
    RouteHref.inject = function () {
        return [aureliaRouter.Router, aureliaPal.DOM.Element];
    };
    RouteHref.prototype.bind = function () {
        this.isActive = true;
        this.processChange();
    };
    RouteHref.prototype.unbind = function () {
        this.isActive = false;
    };
    RouteHref.prototype.attributeChanged = function (value, previous) {
        if (previous) {
            this.element.removeAttribute(previous);
        }
        this.processChange();
    };
    RouteHref.prototype.processChange = function () {
        var _this = this;
        return this.router
            .ensureConfigured()
            .then(function () {
            if (!_this.isActive) {
                return null;
            }
            var element = _this.element;
            var href = _this.router.generate(_this.route, _this.params);
            if (element.au.controller) {
                element.au.controller.viewModel[_this.attribute] = href;
            }
            else {
                element.setAttribute(_this.attribute, href);
            }
            return null;
        })
            .catch(function (reason) {
            logger.error(reason);
        });
    };
    /*@internal */
    RouteHref.$resource = {
        type: 'attribute',
        name: 'route-href',
        bindables: [
            { name: 'route', changeHandler: 'processChange', primaryProperty: true },
            { name: 'params', changeHandler: 'processChange' },
            { name: 'attribute', defaultValue: 'href' }
        ]
    };
    return RouteHref;
}());

function configure(config) {
    config
        .singleton(aureliaRouter.RouteLoader, TemplatingRouteLoader)
        .singleton(aureliaRouter.Router, aureliaRouter.AppRouter)
        .globalResources(RouterView, RouteHref);
    config.container.registerAlias(aureliaRouter.Router, aureliaRouter.AppRouter);
}

exports.configure = configure;
exports.TemplatingRouteLoader = TemplatingRouteLoader;
exports.RouterView = RouterView;
exports.RouteHref = RouteHref;
