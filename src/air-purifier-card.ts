/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LitElement,
  html,
  TemplateResult,
  css,
  PropertyValues,
  CSSResultGroup,
} from 'lit';
import { customElement, property, state } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import {
  HomeAssistant,
  hasConfigOrEntityChanged,
  LovelaceCardEditor,
  getLovelace,
  fireEvent,
} from 'custom-card-helpers'; // This is a community maintained npm module with common helper functions/types. https://github.com/custom-cards/custom-card-helpers


import './editor';

import type { AirPurifierCardConfig } from './types';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';
import { mdiAirFilter, mdiLightbulbOnOutline, mdiLockOpenOutline, mdiLockOutline, mdiWeatherWindy, mdiFanAuto, mdiDotsVertical, mdiLightbulbOutline } from '@mdi/js';

/* eslint no-console: 0 */
console.info(
  `%c  AIR-PURIFIER-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// This puts your card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'air-purifier-card',
  name: 'Air purifier Card',
  description: 'A card to control Air Purifier (IKEA Starkvind)',
});

// TODO Name your custom element
@customElement('air-purifier-card')
export class AirPurifierCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('air-purifier-card-editor');
  }

  public static getStubConfig(): Record<string, unknown> {
    return {};
  }

  // TODO Add any properities that should cause your element to re-render here
  // https://lit.dev/docs/components/properties/
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private config!: AirPurifierCardConfig;

  // https://lit.dev/docs/components/properties/#accessors-custom
  public setConfig(config: AirPurifierCardConfig): void {
    // TODO Check for required fields and that they are of the proper format
    if (!config) {
      throw new Error(localize('common.invalid_configuration'));
    }

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this.config = {
      name: 'Air purifier',
      ...config,
    };
  }

  // https://lit.dev/docs/components/lifecycle/#reactive-update-cycle-performing
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.config) {
      return false;
    }

    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  // https://lit.dev/docs/components/rendering/
  protected render(): TemplateResult | void {
    if (!this.hass || !this.config || !this.config.entity) {
      return html``;
    }
    // TODO Check for stateObj or other necessary things and render a warning if missing
    const stateObj = this.hass.states[this.config.entity];
    if (this.config.show_warning) {
      return this._showWarning(localize('common.show_warning'));
    }

    if (this.config.show_error) {
      return this._showError(localize('common.show_error'));
    }

    const fanSpeed =
      stateObj.attributes.fan_speed !== null &&
      stateObj.attributes.fan_speed;

    const ledEnable = stateObj.attributes.led_enable;
    const childLock = stateObj.attributes.child_lock === 'LOCK';
    const filterCheck = stateObj.attributes.replace_filter;
    const mode = stateObj.attributes.fan_mode;
    const pm25 = stateObj.attributes.pm25 != -1 ? stateObj.attributes.pm25 : '-';
    const airQuality = stateObj.attributes.air_quality;
    console.info(`Mode: ${mode}`);
    return html`

      <ha-card>
      <ha-icon-button
          class="more-info"
          .label=${this.hass.localize(
      "ui.panel.lovelace.cards.show_more_info"
    )}
          .path=${mdiDotsVertical}
          @click=${this._handleMoreInfo}
          tabindex="0"
        ></ha-icon-button>
      <div class="content">
          <div id="controls">
            <div id="slider">
              <round-slider
                .value=${fanSpeed}
                .min=${1}
                .max=${9}
                .step=${1}
                @value-changed=${this._setPercentage}
              ></round-slider>
              <div id="slider-center">
                <div id="quality">${this.config.show_value ? `${pm25} µg/m³` : airQuality}</div>
                <ha-icon-button
                  class=${classMap({
                    'power-button': true,
                    'state-on': stateObj.state === 'on'
                  })}
                  tabindex="0"
                  @click=${this._togglePower}
                  .path=${mdiWeatherWindy}>
                </ha-icon-button>
                <div id="modes">
                  <ha-icon-button
                    class=${classMap({ "selected-icon": mode === 'auto', 'auto': true })}
                    .label=${'Auto'}
                    @click=${this._setAuto}
                    .path=${mdiFanAuto}>
                  </ha-icon-button>
                </div>
              </div>
            </div>
          </div>
          <div id="info">
            <div id="modes">
              <ha-icon-button
                class=${classMap({ "selected-icon": childLock, 'locked': true })}
                tabindex="0"
                @click=${this._toggleLock}
                .label=${'Child-lock'}
                .path=${childLock ? mdiLockOutline : mdiLockOpenOutline}>
              </ha-icon-button>
              <ha-icon-button
                class=${classMap({ "selected-icon": ledEnable, 'ledOn': true })}
                tabindex="0"
                @click=${this._toggleLight}
                .label=${'Enable led'}
                .path=${ledEnable ? mdiLightbulbOnOutline : mdiLightbulbOutline}>
              </ha-icon-button>
              <ha-icon-button
                class=${classMap({ "selected-icon": filterCheck, 'filterCheck': true })}
                tabindex="0"
                .label=${'Check filter'}
                .path=${mdiAirFilter}>
              </ha-icon-button>
            </div>
            ${this.config.name}
          </div>
        </div>
    </ha-card>
    `;
  }

  private _togglePower() {
    if (this.hass && this.config) {
      this.hass.callService('fan', 'toggle',
        {
          entity_id: this.config.entity
        });
    }
  }

  private _setPercentage(e): void {
    if (this.hass && this.config && e.detail.value) {
      this.hass.callService('fan', 'set_percentage',
        {
          entity_id: this.config.entity,
          percentage: e.detail.value * 11
        });
    }
  }

  private _setAuto() {
    if (this.hass && this.config) {
      this.hass.callService('fan', 'set_preset_mode',
        {
          entity_id: this.config.entity,
          preset_mode: 'auto'
        });
    }
  }

  private _toggleLock(): void {
    if (this.hass && this.config) {
      this.hass.callService('switch', 'toggle',
        {
          entity_id: this.config.entity?.replace('fan', 'switch') + '_child_lock'
        });
    }
  }

  private _toggleLight(): void {
    if (this.hass && this.config) {
      this.hass.callService('switch', 'toggle',
        {
          entity_id: this.config.entity?.replace('fan', 'switch') + '_led_enable'
        });
    }
  }

  private _handleMoreInfo() {
    fireEvent(this, "hass-more-info", {
      entityId: this.config.entity ?? null,
    });
  }

  private _showWarning(warning: string): TemplateResult {
    return html`
      <hui-warning>${warning}</hui-warning>
    `;
  }

  private _showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card');
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this.config,
    });

    return html`
      ${errorCard}
    `;
  }

  // https://lit.dev/docs/components/styles/
  /*static get styles(): CSSResultGroup {
    return css``;
  }*/
  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
      }
      ha-card {
        height: 100%;
        position: relative;
        overflow: hidden;
        --name-font-size: 1.2rem;
        --brightness-font-size: 1.2rem;
        --rail-border-color: transparent;
      }
      #quality {
        padding: 16px;
        pointer-events: none;
        text-transform: capitalize;
      }
      .ledOn {
        --mode-color: rgb(68, 115, 158);
      }
      .locked {
        --mode-color: #ff8100;
      }
      .auto {
        --mode-color: #008000;
      }
      .filterCheck {
        --mode-color: var(--error-color);
      }

      .power-button {
        color: var(--paper-item-icon-color, #44739e);
        width: 60%;
        height: auto;
        position: absolute;
        max-width: calc(100% - 40px);
        box-sizing: border-box;
        border-radius: 100%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        --mdc-icon-button-size: 100%;
        --mdc-icon-size: 100%;
      }
      .state-on {
        color: var(--paper-item-icon-active-color, #fdd835);
      }
      .auto,
      .heat_cool {
        --mode-color: var(--state-climate-auto-color);
      }
      .cool {
        --mode-color: var(--state-climate-cool-color);
      }
      .heat {
        --mode-color: var(--state-climate-heat-color);
      }
      .manual {
        --mode-color: var(--state-climate-manual-color);
      }
      .off {
        --mode-color: var(--state-climate-off-color);
      }
      .fan_only {
        --mode-color: var(--state-climate-fan_only-color);
      }
      .eco {
        --mode-color: var(--state-climate-eco-color);
      }
      .dry {
        --mode-color: var(--state-climate-dry-color);
      }
      .idle {
        --mode-color: var(--state-climate-idle-color);
      }
      .unknown-mode {
        --mode-color: var(--state-unknown-color);
      }
      .more-info {
        position: absolute;
        cursor: pointer;
        top: 0;
        right: 0;
        border-radius: 100%;
        color: var(--secondary-text-color);
        z-index: 1;
      }
      .content {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      #controls {
        display: flex;
        justify-content: center;
        padding: 16px;
        position: relative;
      }
      #slider {
        height: 100%;
        width: 100%;
        position: relative;
        max-width: 250px;
        min-width: 100px;
      }
      round-slider {
        --round-slider-path-color: var(--slider-track-color);
        --round-slider-bar-color: var(--mode-color);
        padding-bottom: 10%;
      }
      #slider-center {
        position: absolute;
        width: calc(100% - 40px);
        height: calc(100% - 40px);
        box-sizing: border-box;
        border-radius: 100%;
        left: 20px;
        top: 20px;
        text-align: center;
        overflow-wrap: break-word;
        /*pointer-events: none;*/
      }
      #slider-center > #modes {
        position: absolute;
        bottom: 0;
        width: 100%;
      }
      #temperature {
        position: absolute;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 50%;
        top: 45%;
        left: 50%;
      }
      #set-values {
        max-width: 80%;
        transform: translate(0, -50%);
        font-size: 20px;
      }
      #set-mode {
        fill: var(--secondary-text-color);
        font-size: 16px;
      }
      #info {
        display: flex-vertical;
        justify-content: center;
        text-align: center;
        padding: 16px;
        margin-top: -60px;
        font-size: var(--name-font-size);
      }
      #modes {
        pointer-events: none;
      }
      #modes > * {
        color: var(--disabled-text-color);
        cursor: pointer;
        display: inline-block;
        pointer-events: initial;
      }
      #modes .selected-icon {
        color: var(--mode-color);
      }
      text {
        fill: var(--primary-text-color);
      }
    `;
  }
}
