import type { Signal } from '@preact/signals';
import type { JSX } from 'preact';
import type { PrecipitationMode, WeatherMode } from '@dissonance/shared-types';
import type { AtmosphereSignals } from '../state/atmosphere';
import { ColorRow, ControlGroup, SliderRow } from './AtmosphereRow';
import { ToggleLabel } from './VisibilityToggles';

const tuningRowStyle: JSX.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '88px minmax(0, 1fr) 62px',
  alignItems: 'center',
  gap: '7px',
  margin: 0,
};

export type WeatherRowProps = {
  atmosphere: AtmosphereSignals;
  weatherMode: Signal<WeatherMode>;
  precipitationMode: Signal<PrecipitationMode>;
  cloudsVisible: Signal<boolean>;
  onOvercastCommit: () => void;
  onWeatherModeCommit: (mode: WeatherMode) => void;
  onPrecipitationCommit: (mode: PrecipitationMode) => void;
  onCloudsVisibleCommit: (visible: boolean) => void;
  onCloudCountCommit: (value: number) => void;
  onCloudColorCommit: (value: string) => void;
  onCloudOpacityCommit: (value: number) => void;
};

export function WeatherRow({
  atmosphere,
  weatherMode,
  precipitationMode,
  cloudsVisible,
  onOvercastCommit,
  onWeatherModeCommit,
  onPrecipitationCommit,
  onCloudsVisibleCommit,
  onCloudCountCommit,
  onCloudColorCommit,
  onCloudOpacityCommit,
}: WeatherRowProps) {
  return (
    <div class="atmosphere-controls weather-controls">
      <ControlGroup label="Conditions">
        <div class="weather-toggle-grid">
          <ToggleLabel label="Overcast" signal={atmosphere.overcast} onCommit={onOvercastCommit} />
          <label>
            <input
              type="checkbox"
              checked={weatherMode.value === 'windy'}
              onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
                const mode: WeatherMode = event.currentTarget.checked ? 'windy' : 'clear';
                weatherMode.value = mode;
                onWeatherModeCommit(mode);
              }}
            />{' '}
            Windy
          </label>
        </div>
        <label class="weather-select-row">
          <span>Precipitation</span>
          <select
            value={precipitationMode.value}
            onChange={(event: JSX.TargetedEvent<HTMLSelectElement>) => {
              const mode = event.currentTarget.value as PrecipitationMode;
              precipitationMode.value = mode;
              onPrecipitationCommit(mode);
            }}
          >
            <option value="none">None</option>
            <option value="rain">Rain</option>
            <option value="snow">Snow</option>
            <option value="storm">Storm</option>
          </select>
        </label>
      </ControlGroup>

      <ControlGroup label="Clouds">
        <ToggleLabel label="Visible" signal={cloudsVisible} onCommit={onCloudsVisibleCommit} />
        <SliderRow
          label="Count"
          signal={atmosphere.cloudCount}
          min={0} max={60} step={2}
          commitOn="change"
          onCommit={onCloudCountCommit}
          style={tuningRowStyle}
        />
        <SliderRow
          label="Opacity"
          signal={atmosphere.cloudOpacity}
          min={0} max={1} step={0.05}
          format={(value) => value.toFixed(2)}
          commitOn="change"
          onCommit={onCloudOpacityCommit}
          style={tuningRowStyle}
        />
        <ColorRow
          label="Color"
          signal={atmosphere.cloudColor}
          commitOn="change"
          onCommit={onCloudColorCommit}
        />
      </ControlGroup>
    </div>
  );
}
