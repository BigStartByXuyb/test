# CameraControl

## Declaration

```xml
xmlns:camera="clr-namespace:MaxWell.CameraDevice;assembly=MaxWell.CameraDevice"
<camera:CameraControl DesignPanelID="..." />
```

`CameraControl` is the WPF camera viewport for `ControlType=Camera`. It is a public WPF `UserControl` in `MTBase/Gui/UserControls/MaxWell.CameraDevice.dll` and exposes camera, panel, axis, and crossing-line properties.

The target project must reference `MaxWell.CameraDevice.dll`. `DesignPanelID` and `Value` are emitted only when the page mapping supplies them; otherwise the target host supplies runtime bindings. The control uses its runtime default appearance.

## Evidence

- SVN branch `MT_SSD/branches/SSD_V3.0`, assembly SHA-256 `3984e90e02c534d4a56ab95076e72e22efcf62ad000e374d0fb1275a56ae3d30`.
- Managed metadata identifies `CameraControl` as a public WPF `UserControl` and lists `DesignPanelIDProperty`, `CameraNameProperty`, `CameraProperty`, axis properties, and crossing-line properties.
- A generated `F4LaserPreciseFocus` page compiled with the assembly reference and this XAML namespace. Device runtime loading was not exercised.
