"use strict";

var Container = require("aurelia-dependency-injection").Container;
var CustomElement = require("aurelia-templating").CustomElement;
var ViewSlot = require("aurelia-templating").ViewSlot;
var ViewStrategy = require("aurelia-templating").ViewStrategy;
var UseView = require("aurelia-templating").UseView;
var NoView = require("aurelia-templating").NoView;
var Router = require("aurelia-router").Router;
var Origin = require("aurelia-metadata").Origin;
var relativeToFile = require("aurelia-path").relativeToFile;


function makeViewRelative(executionContext, viewPath) {
  var origin = Origin.get(executionContext.constructor);
  return relativeToFile(viewPath, origin.moduleId);
}

var RouterView = function RouterView(element, container, viewSlot) {
  this.element = element;
  this.container = container;
  this.viewSlot = viewSlot;
};

RouterView.annotations = function () {
  return [new CustomElement("router-view"), new NoView()];
};

RouterView.inject = function () {
  return [Element, Container, ViewSlot];
};

RouterView.prototype.created = function (executionContext) {
  this.executionContext = executionContext;
  this.connectToRouterOnExecutionContext();
};

RouterView.prototype.bind = function (executionContext) {
  if (this.executionContext == executionContext) {
    return;
  }

  this.executionContext = executionContext;
  this.connectToRouterOnExecutionContext();
};

RouterView.prototype.getComponent = function (viewModelInfo, createChildRouter, config) {
  var childContainer = this.container.createChild(), viewStrategy = config.view || config.viewStrategy, viewModel;

  childContainer.registerHandler(Router, createChildRouter);
  childContainer.autoRegister(viewModelInfo.value);

  viewModel = childContainer.get(viewModelInfo.value);

  if ("getViewStrategy" in viewModel && !viewStrategy) {
    viewStrategy = viewModel.getViewStrategy();
  }

  if (typeof viewStrategy === "string") {
    viewStrategy = new UseView(makeViewRelative(this.executionContext, viewStrategy));
  }

  if (viewStrategy && !(viewStrategy instanceof ViewStrategy)) {
    throw new Error("The view must be a string or an instance of ViewStrategy.");
  }

  return viewModelInfo.type.load(this.container, viewModelInfo.value, viewStrategy).then(function (behaviorType) {
    return behaviorType.create(childContainer, { executionContext: viewModel, suppressBind: true });
  });
};

RouterView.prototype.process = function (viewPortInstruction) {
  viewPortInstruction.component.bind(viewPortInstruction.component.executionContext);
  this.viewSlot.swap(viewPortInstruction.component.view);

  if (this.view) {
    this.view.unbind();
  }

  this.view = viewPortInstruction.component.view;
};

RouterView.prototype.connectToRouterOnExecutionContext = function () {
  var executionContext = this.executionContext, key, router;

  if ("router" in executionContext && executionContext.router instanceof Router) {
    router = executionContext.router;
  } else {
    for (key in executionContext) {
      if (executionContext[key] instanceof Router) {
        router = executionContext[key];
        break;
      }
    }
  }

  if (!router) {
    throw new Error("In order to use a \"router-view\" the view's executionContext (view model) must have a router property.");
  }

  router.registerViewPort(this, this.element.getAttribute("name"));
};

exports.RouterView = RouterView;