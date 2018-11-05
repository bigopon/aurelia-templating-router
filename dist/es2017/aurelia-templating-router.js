import { Container } from 'aurelia-dependency-injection';
import { createOverrideContext } from 'aurelia-binding';
import { ViewSlot, ViewLocator, BehaviorInstruction, CompositionTransaction, CompositionEngine, ShadowDOM, SwapStrategies, customElement, inlineView, useView } from 'aurelia-templating';
import { Router, RouteLoader, AppRouter } from 'aurelia-router';
import { Origin } from 'aurelia-metadata';
import { DOM } from 'aurelia-pal';
import { relativeToFile } from 'aurelia-path';
import { getLogger } from 'aurelia-logging';

class EmptyViewModel {
}
/**
 * Implementation of Aurelia Router ViewPort. Responsible for loading route, composing and swapping routes views
 */
class RouterView {
    constructor(element, container, viewSlot, router, viewLocator, compositionTransaction, compositionEngine) {
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
    static inject() {
        return [DOM.Element, Container, ViewSlot, Router, ViewLocator, CompositionTransaction, CompositionEngine];
    }
    created(owningView) {
        this.owningView = owningView;
    }
    bind(bindingContext, overrideContext) {
        this.container.viewModel = bindingContext;
        this.overrideContext = overrideContext;
    }
    process(viewPortInstruction, waitToSwap) {
        const component = viewPortInstruction.component;
        const childContainer = component.childContainer;
        const viewModel = component.viewModel;
        const viewModelResource = component.viewModelResource;
        const metadata = viewModelResource.metadata;
        const config = component.router.currentInstruction.config;
        const viewPort = config.viewPorts ? (config.viewPorts[viewPortInstruction.name] || {}) : {};
        childContainer.get(RouterViewLocator)._notify(this);
        // layoutInstruction is our layout viewModel
        const layoutInstruction = {
            viewModel: viewPort.layoutViewModel || config.layoutViewModel || this.layoutViewModel,
            view: viewPort.layoutView || config.layoutView || this.layoutView,
            model: viewPort.layoutModel || config.layoutModel || this.layoutModel,
            router: viewPortInstruction.component.router,
            childContainer: childContainer,
            viewSlot: this.viewSlot
        };
        const viewStrategy = this.viewLocator.getViewStrategy(component.view || viewModel);
        if (viewStrategy && component.view) {
            viewStrategy.makeRelativeTo(Origin.get(component.router.container.viewModel.constructor).moduleId);
        }
        return metadata
            .load(childContainer, viewModelResource.value, null, viewStrategy, true)
            // Wrong typing from aurelia templating
            // it's supposed to be a Promise<ViewFactory>
            .then((viewFactory) => {
            if (!this.compositionTransactionNotifier) {
                this.compositionTransactionOwnershipToken = this.compositionTransaction.tryCapture();
            }
            if (layoutInstruction.viewModel || layoutInstruction.view) {
                viewPortInstruction.layoutInstruction = layoutInstruction;
            }
            viewPortInstruction.controller = metadata.create(childContainer, BehaviorInstruction.dynamic(this.element, viewModel, viewFactory));
            if (waitToSwap) {
                return null;
            }
            this.swap(viewPortInstruction);
        });
    }
    swap(viewPortInstruction) {
        const layoutInstruction = viewPortInstruction.layoutInstruction;
        const previousView = this.view;
        const work = () => {
            let swapStrategy = SwapStrategies[this.swapOrder] || SwapStrategies.after;
            let viewSlot = this.viewSlot;
            swapStrategy(viewSlot, previousView, () => {
                return Promise.resolve(viewSlot.add(this.view));
            }).then(() => {
                this._notify();
            });
        };
        const ready = (owningView) => {
            viewPortInstruction.controller.automate(this.overrideContext, owningView);
            if (this.compositionTransactionOwnershipToken) {
                return this.compositionTransactionOwnershipToken
                    .waitForCompositionComplete()
                    .then(() => {
                    this.compositionTransactionOwnershipToken = null;
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
                .then((controller) => {
                ShadowDOM.distributeView(viewPortInstruction.controller.view, controller.slots || controller.view.slots);
                controller.automate(createOverrideContext(layoutInstruction.viewModel), this.owningView);
                controller.view.children.push(viewPortInstruction.controller.view);
                return controller.view || controller;
            })
                .then((newView) => {
                this.view = newView;
                return ready(newView);
            });
        }
        this.view = viewPortInstruction.controller.view;
        return ready(this.owningView);
    }
    /**@internal */
    _notify() {
        if (this.compositionTransactionNotifier) {
            this.compositionTransactionNotifier.done();
            this.compositionTransactionNotifier = null;
        }
    }
}
/**@internal */
RouterView.$view = null;
/**@internal */
RouterView.$resource = {
    name: 'router-view',
    bindables: ['swapOrder', 'layoutView', 'layoutViewModel', 'layoutModel']
};
/**
* Locator which finds the nearest RouterView, relative to the current dependency injection container.
*/
class RouterViewLocator {
    /**
    * Creates an instance of the RouterViewLocator class.
    */
    constructor() {
        this.promise = new Promise((resolve) => this.resolve = resolve);
    }
    /**
    * Finds the nearest RouterView instance.
    * @returns A promise that will be resolved with the located RouterView instance.
    */
    findNearest() {
        return this.promise;
    }
    /**@internal */
    _notify(routerView) {
        this.resolve(routerView);
    }
}

class EmptyClass {
}
inlineView('<template></template>')(EmptyClass);
class TemplatingRouteLoader extends RouteLoader {
    constructor(compositionEngine) {
        super();
        this.compositionEngine = compositionEngine;
    }
    loadRoute(router, config, _navInstruction) {
        const childContainer = router.container.createChild();
        let promise;
        // let viewModel: string | /**Constructable */ Function | null | Record<string, any>;
        if ('moduleId' in config) {
            let viewModel;
            let moduleId = config.moduleId;
            if (moduleId === null) {
                viewModel = EmptyClass;
            }
            else if (/\.html/i.test(moduleId)) {
                viewModel = createDynamicClass(moduleId);
            }
            else {
                viewModel = relativeToFile(moduleId, Origin.get(router.container.viewModel.constructor).moduleId);
            }
            promise = Promise.resolve(viewModel);
        }
        else if ('viewModel' in config) {
            // Implementation wise, the router already ensure this is a synchronous call
            // but interface wise it's annoying
            promise = Promise
                .resolve(config.viewModel())
                .then(vm => {
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
            .then(viewModel => {
            const instruction = {
                viewModel: viewModel,
                childContainer: childContainer,
                view: config.view || config.viewStrategy,
                router: router
            };
            childContainer.registerSingleton(RouterViewLocator);
            childContainer.getChildRouter = function () {
                let childRouter;
                childContainer.registerHandler(Router, () => {
                    return childRouter || (childRouter = router.createChild(childContainer));
                });
                return childContainer.get(Router);
            };
            return this.compositionEngine.ensureViewModel(instruction);
        });
    }
}
/**@internal */
TemplatingRouteLoader.inject = [CompositionEngine];
function createDynamicClass(moduleId) {
    const name = /([^\/^\?]+)\.html/i.exec(moduleId)[1];
    class DynamicClass {
        bind(bindingContext) {
            this.$parent = bindingContext;
        }
    }
    customElement(name)(DynamicClass);
    useView(moduleId)(DynamicClass);
    return DynamicClass;
}

const logger = getLogger('route-href');
/**
 * Helper custom attribute to help associate an element with a route by name
 */
class RouteHref {
    constructor(router, element) {
        this.router = router;
        this.element = element;
    }
    /*@internal */
    static inject() {
        return [Router, DOM.Element];
    }
    bind() {
        this.isActive = true;
        this.processChange();
    }
    unbind() {
        this.isActive = false;
    }
    attributeChanged(value, previous) {
        if (previous) {
            this.element.removeAttribute(previous);
        }
        this.processChange();
    }
    processChange() {
        return this.router
            .ensureConfigured()
            .then(() => {
            if (!this.isActive) {
                return null;
            }
            const element = this.element;
            let href = this.router.generate(this.route, this.params);
            if (element.au.controller) {
                element.au.controller.viewModel[this.attribute] = href;
            }
            else {
                element.setAttribute(this.attribute, href);
            }
            return null;
        })
            .catch(reason => {
            logger.error(reason);
        });
    }
}
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

function configure(config) {
    config
        .singleton(RouteLoader, TemplatingRouteLoader)
        .singleton(Router, AppRouter)
        .globalResources(RouterView, RouteHref);
    config.container.registerAlias(Router, AppRouter);
}

export { configure, TemplatingRouteLoader, RouterView, RouteHref };
