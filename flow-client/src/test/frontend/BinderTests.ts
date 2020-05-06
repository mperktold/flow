/* tslint:disable:max-classes-per-file */

const {suite, test, beforeEach, afterEach} = intern.getInterface("tdd");
const {assert} = intern.getPlugin("chai");
/// <reference types="sinon">
const {sinon} = intern.getPlugin('sinon');
import { expect } from "chai";

// API to test
import {
  Binder,
  getModelValidators,
  getName,
  getValue,
  setValue,
  validate,
  Validator,
  modelRepeat,
  field,
  appendItem
} from "../../main/resources/META-INF/resources/frontend/Binder";

import { Order, OrderModel } from "./BinderModels";

import { customElement, html, LitElement, query, css} from 'lit-element';

@customElement('lit-order-view')
class LitOrderView extends LitElement {}

@customElement('order-view')
export default class OrderView extends LitElement {
  public binder = new Binder(this, OrderModel, () => this.requestUpdate());
  @query('#notes') public notes!: Element;
  @query('#fullName') public fullName!: Element;
  @query('#add') public add!: Element;
  @query('#description0') public description!: Element;
  @query('#price0') public price!: Element;

  static get styles() {
    return css`input[invalid] {border: 2px solid red;}`;
  }
  render() {
    return html`
    <input id="notes" ...="${field(this.binder.model.notes)}" />
    <input id="fullName" ...="${field(this.binder.model.customer.fullName)}" />
    <button id="add" @click=${() => appendItem(this.binder.model.products)}>+</button>
    ${modelRepeat(this.binder.model.products, (model, _product, index) => html`<div>
        <input id="description${index}" ...="${field(model.description)}" />
        <input id="price${index}" ...="${field(model.price)}">
      </div>`)}
    `;
  }
}

const sleep = async (t: number) => new Promise(resolve => setTimeout(() => resolve(), t));
const fireEvent = async (elm: Element, name: string) => {
  elm.dispatchEvent(new CustomEvent(name));
  return sleep(0);
}

suite("Binder", () => {
  const litOrderView = document.createElement('lit-order-view') as LitOrderView;
  const requestUpdateStub = sinon.stub(litOrderView, 'requestUpdate').resolves();

  afterEach(() => {
    requestUpdateStub.reset();
  });

  test("should instantiate without type arguments", () => {
    const binder = new Binder(litOrderView, OrderModel, () => litOrderView.requestUpdate());

    assert.isDefined(binder);
    assert.isDefined(binder.value.notes);
    assert.isDefined(binder.value.idString);
    assert.isDefined(binder.value.customer.fullName);
    assert.isDefined(binder.value.customer.idString);
  });

  test("should instantiate model", () => {
    const binder = new Binder(litOrderView, OrderModel, () => litOrderView.requestUpdate());

    assert.instanceOf(binder.model, OrderModel);
  });

  suite("name value", () => {
    let binder: Binder<Order, OrderModel<Order>>;

    const expectedEmptyOrder: Order = {
      idString: '',
      customer: {
        idString: '',
        fullName: '',
      },
      notes: '',
      priority: 0,
      products: []
    };

    beforeEach(() => {
      binder = new Binder(
        litOrderView,
        OrderModel,
        () => litOrderView.requestUpdate()
      );
      requestUpdateStub.reset();
    });

    test("should have name for models", () => {
      assert.equal(getName(binder.model.notes), "notes");
      assert.equal(getName(binder.model.customer.fullName), "customer[fullName]");
    });

    test("should have initial defaultValue", () => {
      assert.deepEqual(binder.defaultValue, expectedEmptyOrder);
    });

    test("should have initial value", () => {
      assert.equal(binder.value, binder.defaultValue);
      assert.equal(getValue(binder.model), binder.value);
      assert.equal(getValue(binder.model.notes), "");
      assert.equal(getValue(binder.model.customer.fullName), "");
    });

    test("should change value on setValue", () => {
      // Sanity check: requestUpdate should not be called
      sinon.assert.notCalled(requestUpdateStub);

      setValue(binder.model.notes, "foo");
      assert.equal(binder.value.notes, "foo");
      sinon.assert.calledOnce(requestUpdateStub);
    });

    test("should change value on deep setValue", () => {
      sinon.assert.notCalled(requestUpdateStub);

      setValue(binder.model.customer.fullName, "foo");
      assert.equal(binder.value.customer.fullName, "foo");
      sinon.assert.calledOnce(litOrderView.requestUpdate);
    });

    test("should not change defaultValue on setValue", () => {
      setValue(binder.model.notes, "foo");
      setValue(binder.model.customer.fullName, "foo");

      assert.equal(binder.defaultValue.notes, "");
      assert.equal(binder.defaultValue.customer.fullName, "");
    });

    test("should reset to default value", () => {
      setValue(binder.model.notes, "foo");
      setValue(binder.model.customer.fullName, "foo");
      requestUpdateStub.reset();

      binder.reset();

      assert.equal(binder.value.notes, "");
      assert.equal(binder.value.customer.fullName, "");
      sinon.assert.calledOnce(requestUpdateStub);
    });

    test("should reset to provided value", () => {
      setValue(binder.model.notes, "foo");
      setValue(binder.model.customer.fullName, "foo");
      requestUpdateStub.reset();

      binder.reset({
        ...expectedEmptyOrder,
        notes: "bar",
        customer: {
          ...expectedEmptyOrder.customer,
          fullName: "bar"
        }
      });

      assert.equal(binder.value.notes, "bar");
      assert.equal(binder.value.customer.fullName, "bar");
      sinon.assert.calledOnce(requestUpdateStub);
    });
  });

  suite("validation", () => {
    let binder: Binder<Order, OrderModel<Order>>;

    beforeEach(async () => {
      binder = new Binder(
        litOrderView,
        OrderModel,
        () => litOrderView.requestUpdate()
      );
    });

    test("should not have validation errors for a model without validators", () => {
      assert.isEmpty(validate(binder.model));
    });

    test("should fail validation after adding a synchronous validator", () => {
      class SyncValidator implements Validator<Order>{
        message = "foo";
        validate = () => false;
      }
      getModelValidators(binder.model.priority).add(new SyncValidator());
      return validate(binder.model.priority).then(errMsg => {
        expect(errMsg[0]).to.equal("foo");
      });
    });

    test("should fail validation after adding an asynchronous validator", () => {
      class AsyncValidator implements Validator<Order>{
        message = "bar";
        validate = async () =>{
          await new Promise(resolve => setTimeout(resolve, 10));
          return false;
        };
      }
      getModelValidators(binder.model.priority).add(new AsyncValidator());
      return validate(binder.model.priority).then(errMsg => {
        expect(errMsg[0]).to.equal("bar");
      });
    });

    suite('field element', () => {
      let orderView: OrderView;

      beforeEach(async () => {
        orderView = document.createElement('order-view') as OrderView;
        binder = new Binder(orderView, OrderModel, () => orderView.requestUpdate());
        document.body.appendChild(orderView);
        return sleep(10);
      });

      afterEach(async () => {
        document.body.removeChild(orderView)
      });

      ['input', 'change', 'blur'].forEach(event => {
        test(`should validate field on ${event}`, async () => {
          expect(orderView.notes.hasAttribute('invalid')).to.be.false;
          await fireEvent(orderView.notes, event);
          expect(orderView.notes.hasAttribute('invalid')).to.be.true;
        });

        test(`should validate field of nested model on  ${event}`, async () => {
          await fireEvent(orderView.add, 'click');
          expect(orderView.description.hasAttribute('invalid')).to.be.false;
          await fireEvent(orderView.description, event);
          expect(orderView.description.hasAttribute('invalid')).to.be.true;
        });
      });

      test(`should validate fields on submit`, async () => {
        expect(orderView.notes.hasAttribute('invalid')).to.be.false;
        expect(orderView.fullName.hasAttribute('invalid')).to.be.false;

        expect(await orderView.binder.submitTo(async (item) => item)).to.be.undefined;

        expect(orderView.notes.hasAttribute('invalid')).to.be.true;
        expect(orderView.fullName.hasAttribute('invalid')).to.be.true;
      });

      test(`should validate fields of nested model on submit`, async () => {
        expect(orderView.description).to.be.null;
        await fireEvent(orderView.add, 'click');

        expect(orderView.description.hasAttribute('invalid')).to.be.false;
        expect(orderView.price.hasAttribute('invalid')).to.be.false;

        expect(await orderView.binder.submitTo(async (item) => item)).to.be.undefined;

        expect(orderView.description.hasAttribute('invalid')).to.be.true;
        expect(orderView.price.hasAttribute('invalid')).to.be.true;
      });

      test(`should validate fields of arrays on submit`, async () => {
        expect(orderView.description).to.be.null;
        await fireEvent(orderView.add, 'click');

        expect(orderView.description.hasAttribute('invalid')).to.be.false;
        expect(orderView.price.hasAttribute('invalid')).to.be.false;

        expect(await orderView.binder.submitTo(async (item) => item)).to.be.undefined;

        expect(orderView.description.hasAttribute('invalid')).to.be.true;
        expect(orderView.price.hasAttribute('invalid')).to.be.true;
      });
    });

  });
});



