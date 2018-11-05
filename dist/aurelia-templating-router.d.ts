import { OverrideContext } from 'aurelia-binding';
import { Container } from 'aurelia-dependency-injection';
import { NavigationInstruction, RouteConfig, RouteLoader, Router, ViewPort, ViewPortComponent, ViewPortInstruction } from 'aurelia-router';
import { CompositionEngine, CompositionTransaction, View, ViewLocator, ViewSlot } from 'aurelia-templating';

export declare class TemplatingRouteLoader extends RouteLoader {
	compositionEngine: CompositionEngine;
	constructor(compositionEngine: CompositionEngine);
	loadRoute(router: Router, config: RouteConfig, _navInstruction: NavigationInstruction): Promise<ViewPortComponent>;
}
/**
 * Implementation of Aurelia Router ViewPort. Responsible for loading route, composing and swapping routes views
 */
export declare class RouterView implements ViewPort {
	/**
	 * Swapping order when going to a new route. By default, supports 3 value: before, after, with
	 * - Before = new in -> old out
	 * - After = old out -> new in
	 * - with = new in + old out
	 *
	 * These values are defined by swapStrategies export in aurelia-templating/ aurelia-framework
	 */
	swapOrder: string;
	layoutView: any;
	layoutViewModel: string | Function | object;
	layoutModel: any;
	/**
	 * Element associated with this <router-view/> custom element
	 */
	readonly element: Element;
	/**
	 * Current router associated with this <router-view/>
	 */
	readonly router: Router;
	/**
	 * Container at this <router-view/> level
	 */
	container: Container;
	constructor(element: Element, container: Container, viewSlot: ViewSlot, router: Router, viewLocator: ViewLocator, compositionTransaction: CompositionTransaction, compositionEngine: CompositionEngine);
	created(owningView: View): void;
	bind(bindingContext: any, overrideContext: OverrideContext): void;
	process(viewPortInstruction: ViewPortInstruction, waitToSwap?: boolean): Promise<any>;
	swap(viewPortInstruction: ViewPortInstruction): void | Promise<void>;
}
/**
 * Helper custom attribute to help associate an element with a route by name
 */
export declare class RouteHref {
	/**
	 * Current router of this attribute
	 */
	readonly router: Router;
	/**
	 * Element this attribute is associated with
	 */
	readonly element: Element;
	/**
	 * Name of the route this attribute refers to. This name should exist in the current router hierarchy
	 */
	route: string;
	/**
	 * Parameters of this attribute to generate URL.
	 */
	params: Record<string, any>;
	/**
	 * Target property on a custom element if this attribute is put on a custom element
	 * OR an attribute if this attribute is put on a normal element
	 */
	attribute: string;
	constructor(router: Router, element: Element);
	bind(): void;
	unbind(): void;
	attributeChanged(value: any, previous: any): void;
	processChange(): Promise<any>;
}
export interface IFrameworkConfiguration {
	container: Container;
	singleton(...args: any[]): this;
	globalResources(...args: any[]): this;
}
export declare function configure(config: IFrameworkConfiguration): void;