/**
 * Pre-parsed KiCad symbol data for each component type.
 * Raw .kicad_sym text is parsed once at import time.
 */

export const KICAD_SYMBOL_SOURCES: Record<string, string> = {
  resistor: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "R"
      (symbol "R_0_1"
        (rectangle (start -1.016 -2.54) (end 1.016 2.54) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "R_1_1"
        (pin passive line (at 0 3.81 270) (length 1.27) (name "" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 0 -3.81 90) (length 1.27) (name "" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  capacitor: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "C"
      (symbol "C_0_1"
        (polyline (pts (xy -2.032 0.762) (xy 2.032 0.762)) (stroke (width 0.508) (type default)) (fill (type none)))
        (polyline (pts (xy -2.032 -0.762) (xy 2.032 -0.762)) (stroke (width 0.508) (type default)) (fill (type none)))
      )
      (symbol "C_1_1"
        (pin passive line (at 0 3.81 270) (length 2.794) (name "" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 0 -3.81 90) (length 2.794) (name "" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  inductor: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "L"
      (symbol "L_0_1"
        (arc (start 0 2.54) (mid 0.6323 1.905) (end 0 1.27) (stroke (width 0) (type default)) (fill (type none)))
        (arc (start 0 1.27) (mid 0.6323 0.635) (end 0 0) (stroke (width 0) (type default)) (fill (type none)))
        (arc (start 0 0) (mid 0.6323 -0.635) (end 0 -1.27) (stroke (width 0) (type default)) (fill (type none)))
        (arc (start 0 -1.27) (mid 0.6323 -1.905) (end 0 -2.54) (stroke (width 0) (type default)) (fill (type none)))
      )
      (symbol "L_1_1"
        (pin passive line (at 0 3.81 270) (length 1.27) (name "1" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 0 -3.81 90) (length 1.27) (name "2" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  diode: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "D"
      (symbol "D_0_1"
        (polyline (pts (xy -1.27 1.27) (xy -1.27 -1.27)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 1.27 1.27) (xy 1.27 -1.27) (xy -1.27 0) (xy 1.27 1.27)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 1.27 0) (xy -1.27 0)) (stroke (width 0) (type default)) (fill (type none)))
      )
      (symbol "D_1_1"
        (pin passive line (at -3.81 0 0) (length 2.54) (name "K" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 3.81 0 180) (length 2.54) (name "A" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  led: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "LED"
      (symbol "LED_0_1"
        (polyline (pts (xy -3.048 -0.762) (xy -4.572 -2.286) (xy -3.81 -2.286) (xy -4.572 -2.286) (xy -4.572 -1.524)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy -1.778 -0.762) (xy -3.302 -2.286) (xy -2.54 -2.286) (xy -3.302 -2.286) (xy -3.302 -1.524)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy -1.27 0) (xy 1.27 0)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy -1.27 -1.27) (xy -1.27 1.27)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 1.27 -1.27) (xy 1.27 1.27) (xy -1.27 0) (xy 1.27 -1.27)) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "LED_1_1"
        (pin passive line (at -3.81 0 0) (length 2.54) (name "K" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 3.81 0 180) (length 2.54) (name "A" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  battery: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "Battery_Cell"
      (symbol "Battery_Cell_0_1"
        (rectangle (start -2.286 1.778) (end 2.286 1.524) (stroke (width 0) (type default)) (fill (type outline)))
        (rectangle (start -1.524 1.016) (end 1.524 0.508) (stroke (width 0) (type default)) (fill (type outline)))
        (polyline (pts (xy 0 1.778) (xy 0 2.54)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 0 0.762) (xy 0 0)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 3.048) (xy 1.778 3.048)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 1.27 3.556) (xy 1.27 2.54)) (stroke (width 0) (type default)) (fill (type none)))
      )
      (symbol "Battery_Cell_1_1"
        (pin passive line (at 0 3.81 270) (length 1.27) (name "+" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 0 -1.27 90) (length 1.27) (name "-" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  switch: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "SW_SPST"
      (symbol "SW_SPST_0_0"
        (circle (center -2.032 0) (radius 0.508) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy -1.524 0.254) (xy 1.524 1.778)) (stroke (width 0) (type default)) (fill (type none)))
        (circle (center 2.032 0) (radius 0.508) (stroke (width 0) (type default)) (fill (type none)))
      )
      (symbol "SW_SPST_1_1"
        (pin passive line (at -5.08 0 0) (length 2.54) (name "A" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 5.08 0 180) (length 2.54) (name "B" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  ground: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "GND"
      (symbol "GND_0_1"
        (polyline (pts (xy 0 0) (xy 0 -1.27) (xy 1.27 -1.27) (xy 0 -2.54) (xy -1.27 -1.27) (xy 0 -1.27)) (stroke (width 0) (type default)) (fill (type none)))
      )
      (symbol "GND_1_1"
        (pin power_in line (at 0 0 270) (length 0) (name "" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  voltmeter: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "Voltmeter_DC"
      (symbol "Voltmeter_DC_0_1"
        (circle (center 0 0) (radius 2.54) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy -0.762 0) (xy 0.762 0)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy -0.381 -0.508) (xy -0.381 0.508)) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "Voltmeter_DC_1_1"
        (pin passive line (at 0 5.08 270) (length 2.54) (name "+" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 0 -5.08 90) (length 2.54) (name "-" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  ammeter: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "Ammeter_DC"
      (symbol "Ammeter_DC_0_1"
        (circle (center 0 0) (radius 2.54) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy -0.762 -0.508) (xy 0 0.508) (xy 0.762 -0.508)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0 0.508) (xy 0 -0.254)) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "Ammeter_DC_1_1"
        (pin passive line (at 0 5.08 270) (length 2.54) (name "+" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 0 -5.08 90) (length 2.54) (name "-" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  npn_transistor: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "Q_NPN_BCE"
      (symbol "Q_NPN_BCE_0_1"
        (polyline (pts (xy -2.54 0) (xy 0.635 0)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 0.635 1.905) (xy 0.635 -1.905)) (stroke (width 0.508) (type default)) (fill (type none)))
        (circle (center 1.27 0) (radius 2.8194) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "Q_NPN_BCE_1_1"
        (polyline (pts (xy 0.635 0.635) (xy 2.54 2.54)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 0.635 -0.635) (xy 2.54 -2.54)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 1.27 -1.778) (xy 1.778 -1.27) (xy 2.286 -2.286) (xy 1.27 -1.778)) (stroke (width 0) (type default)) (fill (type outline)))
        (pin input line (at -5.08 0 0) (length 2.54) (name "B" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 2.54 5.08 270) (length 2.54) (name "C" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 2.54 -5.08 90) (length 2.54) (name "E" (effects (font (size 1.27 1.27)))) (number "3" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  pnp_transistor: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "Q_PNP_BCE"
      (symbol "Q_PNP_BCE_0_1"
        (polyline (pts (xy -2.54 0) (xy 0.635 0)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 0.635 1.905) (xy 0.635 -1.905)) (stroke (width 0.508) (type default)) (fill (type none)))
        (polyline (pts (xy 0.635 0.635) (xy 2.54 2.54)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 0.635 -0.635) (xy 2.54 -2.54)) (stroke (width 0) (type default)) (fill (type none)))
        (circle (center 1.27 0) (radius 2.8194) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 2.286 -1.778) (xy 1.778 -2.286) (xy 1.27 -1.27) (xy 2.286 -1.778)) (stroke (width 0) (type default)) (fill (type outline)))
      )
      (symbol "Q_PNP_BCE_1_1"
        (pin input line (at -5.08 0 0) (length 2.54) (name "B" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 2.54 5.08 270) (length 2.54) (name "C" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 2.54 -5.08 90) (length 2.54) (name "E" (effects (font (size 1.27 1.27)))) (number "3" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  nmos_transistor: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "Q_NMOS_GDS"
      (symbol "Q_NMOS_GDS_0_1"
        (polyline (pts (xy -2.54 0) (xy 0.254 0)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 0.254 1.905) (xy 0.254 -1.905)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 2.286) (xy 0.762 1.27)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 0.508) (xy 0.762 -0.508)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 -1.27) (xy 0.762 -2.286)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 -1.778) (xy 3.302 -1.778) (xy 3.302 1.778) (xy 0.762 1.778)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 1.016 0) (xy 2.032 0.381) (xy 2.032 -0.381) (xy 1.016 0)) (stroke (width 0) (type default)) (fill (type outline)))
        (circle (center 1.651 0) (radius 2.794) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 2.54 2.54) (xy 2.54 1.778)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 2.54 -2.54) (xy 2.54 0) (xy 0.762 0)) (stroke (width 0) (type default)) (fill (type none)))
      )
      (symbol "Q_NMOS_GDS_1_1"
        (pin input line (at -5.08 0 0) (length 2.54) (name "G" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 2.54 5.08 270) (length 2.54) (name "D" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 2.54 -5.08 90) (length 2.54) (name "S" (effects (font (size 1.27 1.27)))) (number "3" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,

  pmos_transistor: `(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "9.99")
    (symbol "Q_PMOS_GDS"
      (symbol "Q_PMOS_GDS_0_1"
        (polyline (pts (xy -2.54 0) (xy 0.254 0)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 0.254 1.905) (xy 0.254 -1.905)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 2.286) (xy 0.762 1.27)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 0.508) (xy 0.762 -0.508)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 -1.27) (xy 0.762 -2.286)) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 0.762 -1.778) (xy 3.302 -1.778) (xy 3.302 1.778) (xy 0.762 1.778)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 2.032 0) (xy 1.016 0.381) (xy 1.016 -0.381) (xy 2.032 0)) (stroke (width 0) (type default)) (fill (type outline)))
        (circle (center 1.651 0) (radius 2.794) (stroke (width 0.254) (type default)) (fill (type none)))
        (polyline (pts (xy 2.54 2.54) (xy 2.54 1.778)) (stroke (width 0) (type default)) (fill (type none)))
        (polyline (pts (xy 2.54 -2.54) (xy 2.54 0) (xy 0.762 0)) (stroke (width 0) (type default)) (fill (type none)))
      )
      (symbol "Q_PMOS_GDS_1_1"
        (pin input line (at -5.08 0 0) (length 2.54) (name "G" (effects (font (size 1.27 1.27)))) (number "1" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 2.54 5.08 270) (length 2.54) (name "D" (effects (font (size 1.27 1.27)))) (number "2" (effects (font (size 1.27 1.27)))))
        (pin passive line (at 2.54 -5.08 90) (length 2.54) (name "S" (effects (font (size 1.27 1.27)))) (number "3" (effects (font (size 1.27 1.27)))))
      )
    )
  )`,
};
