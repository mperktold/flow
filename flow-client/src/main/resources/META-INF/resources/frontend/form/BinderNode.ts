/*
 * Copyright 2000-2020 Vaadin Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
import {Binder, binderNodesSymbol} from "./Binder";
import {BinderState} from "./BinderState";
import {
  AbstractModel,
  binderNodeSymbol, getBinder,
  getName,
  getValue,
  keySymbol,
  parentSymbol,
  setValue,
  validatorsSymbol
} from "./Models";
import {Required, Validator, ValueError} from "./Validation";

const errorsSymbol = Symbol('errors');
const visitedSymbol = Symbol('visited');

export class BinderNode<T, M extends AbstractModel<T>> implements BinderState<T, M> {
  private [visitedSymbol]: boolean = false;
  private [validatorsSymbol]: ReadonlyArray<Validator<T>>;
  private [errorsSymbol]: ReadonlyArray<ValueError<any>> = [];

  readonly binder: Binder<any, AbstractModel<any>>;

  constructor(readonly model: M, ...validators: ReadonlyArray<Validator<T>>) {
    this.binder = getBinder(model)!;
    if (!this.binder) {
      return;
    }

    this.model = model;
    this[validatorsSymbol] = validators;

    this.binder[binderNodesSymbol].add(this);
  }

  get parent(): BinderNode<any, AbstractModel<any>> {
    return this.model[parentSymbol][binderNodeSymbol];
  }

  get isRoot(): boolean {
    return this.parent === this;
  }

  get name(): string {
    return getName(this.model);
  }

  get value(): T {
    return getValue(this.model);
  }

  set value(newValue: T) {
    if (newValue !== this.value) {
      setValue(this.model, newValue);
      this.validate();
    }
  }

  get defaultValue(): T {
    if (this.isRoot) {
      return this.binder.defaultValue;
    }

    return this.parent.defaultValue[this.model[keySymbol]];
  }

  get dirty(): boolean {
    return this.value !== this.defaultValue;
  }

  get validators(): ReadonlyArray<Validator<T>> {
    return this[validatorsSymbol];
  }

  set validators(validators: ReadonlyArray<Validator<T>>) {
    this[validatorsSymbol] = validators;
    this.validate();
  }

  requestValidation(): ReadonlyArray<Promise<ValueError<any> | void>> {
    return this[validatorsSymbol].map(
      validator => this.binder.requestValidation(this.model, validator)
    );
  }

  delete() {
    this.binder[binderNodesSymbol].delete(this);
  }

  async validate(): Promise<void> {
    const name = this.name;
    const errors = await Promise.all(this.requestValidationWithParents());
    this[errorsSymbol] = errors.filter(
      valueError => valueError && valueError.property.startsWith(name)
    ) as ReadonlyArray<ValueError<any>>;
  }

  async addValidator(validator: Validator<T>) {
    this.validators = [...this[validatorsSymbol], validator];
  }

  get visited() {
    return this[visitedSymbol];
  }

  set visited(v) {
    if (this[visitedSymbol] !== v) {
      this[visitedSymbol] = v;
      this.validate();
    }
  }

  get errors() {
    return this[errorsSymbol];
  }

  get ownErrors() {
    const name = this.name;
    return this.errors.filter(valueError => valueError.property === name);
  }

  get invalid() {
    return this[errorsSymbol].length > 0;
  }

  get required() {
    return !!this[validatorsSymbol].find(val => val instanceof Required);
  }

  private requestValidationWithParents(): ReadonlyArray<Promise<ValueError<any> | void>> {
    return ([
      ...this.requestValidation(),
      ...(this.isRoot ? [] : this.parent.requestValidationWithParents())
    ]);
  }
}
