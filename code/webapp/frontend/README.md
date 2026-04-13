# Circuitron - Handwritten Circuit Simulation Frontend

A professional, responsive Next.js frontend application for handwritten circuit simulation, similar to EveryCircuit. Built with TypeScript, Tailwind CSS, and featuring dark/light mode support.

## ✨ Features

- **Professional Circuit Drawing Interface**: Clean, intuitive canvas for drawing electronic circuits
- **Component Library**: Comprehensive library of electronic components (resistors, capacitors, logic gates, etc.)
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Dark/Light Mode**: Full theme support with smooth transitions
- **Drag & Drop**: Easy component placement from the sidebar palette
- **Professional Tools**: Selection, wiring, panning, zooming tools
- **Properties Panel**: Edit component values and properties
- **Keyboard Shortcuts**: Professional keyboard shortcuts for efficient workflow
- **State Management**: Robust state management with undo/redo functionality
- **TypeScript**: Full type safety throughout the application

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Context + useReducer
- **Theme**: Custom theme system with CSS variables

## 📋 Components Library

### Passive Components

- Resistor
- Capacitor
- Inductor

### Active Components

- Diode
- LED
- Switch

### Sources

- Battery
- Ground

### Meters

- Voltmeter
- Ammeter

### Logic Gates

- AND Gate
- OR Gate
- NOT Gate
- NAND Gate
- NOR Gate
- XOR Gate

## ⌨️ Keyboard Shortcuts

### Tools

- `V` - Select tool
- `W` - Wire tool
- `H` - Pan tool
- `T` - Text tool

### View

- `+/=` - Zoom in
- `-` - Zoom out
- `G` - Toggle grid

### Edit

- `Delete/Backspace` - Delete selected components
- `Ctrl+Z` - Undo
- `Ctrl+Shift+Z` / `Ctrl+Y` - Redo
- `Ctrl+A` - Select all
- `Ctrl+D` - Deselect all
- `Ctrl+N` - New circuit

### General

- `Ctrl+B` - Toggle sidebar
- `Escape` - Close sidebar/panels

## 🎨 Responsive Design

The application adapts to different screen sizes:

- **Desktop**: Full sidebar, toolbar, and properties panel
- **Tablet**: Collapsible sidebar with touch-friendly controls
- **Mobile**: Mobile-first responsive design with optimized touch interactions

## 🎯 Dark/Light Mode

Automatic theme detection with manual toggle:

- Respects system preference on first load
- Persistent theme selection
- Smooth transitions between themes
- Comprehensive color scheme for both modes

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
├── components/
│   ├── circuit/           # Circuit-specific components
│   │   ├── canvas.tsx     # Main drawing canvas
│   │   └── properties-panel.tsx
│   ├── layout/            # Layout components
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── toolbar.tsx
│   │   └── layout.tsx
│   └── ui/                # Reusable UI components
│       └── button.tsx
├── context/               # React contexts
│   ├── theme-context.tsx
│   └── circuit-context.tsx
├── types/                 # TypeScript type definitions
│   └── circuit.ts
├── utils/                 # Utility functions
│   └── index.ts
├── hooks/                 # Custom hooks
│   └── use-keyboard-shortcuts.ts
└── constants/             # Application constants
    └── components.ts
```

## 🚀 Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Run the development server**:

   ```bash
   npm run dev
   ```

3. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🎯 Usage

1. **Add Components**: Drag components from the sidebar onto the canvas
2. **Select Tool**: Use the select tool (V) to select and move components
3. **Wire Components**: Use the wire tool (W) to connect components
4. **Edit Properties**: Select a component to edit its properties in the right panel
5. **Navigate**: Use pan tool (H) or mouse wheel to navigate the canvas
6. **Zoom**: Use zoom controls or +/- keys to zoom in/out

## 🎨 Customization

### Adding New Components

1. Add component definition to `src/constants/components.ts`
2. Update `ComponentType` in `src/types/circuit.ts`
3. Component will automatically appear in the sidebar

### Theming

Customize themes by modifying CSS variables in `src/app/globals.css`

## 🔄 State Management

The application uses React Context with useReducer for state management:

- **Circuit State**: Components, wires, metadata
- **View State**: Current tool, zoom, pan, selection
- **Undo/Redo**: Full undo/redo stack implementation

## 📱 Mobile Optimizations

- Touch-friendly interface
- Responsive sidebar navigation
- Mobile-optimized tool selection
- Gesture support for pan and zoom

## 🎯 Future Enhancements

- Circuit simulation engine
- Save/load functionality
- Component search and filtering
- Advanced wire routing
- Multi-page circuits
- Export functionality (PNG, SVG, PDF)
- Collaborative editing
- Component library expansion

## 📄 License

This project is built for educational purposes as a college major project.

## 🤝 Contributing

This is a college project, but suggestions and feedback are welcome!

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS
