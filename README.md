# Wardrobe 2025

A modern 3D wardrobe visualization application built with React Three Fiber, featuring interactive 3D models, VR/AR support, and responsive design.

[**Live Demo**](https://drygiel.github.io/wardrobe/)

## 🚀 Features

### Core Functionality
- **Interactive 3D Wardrobe Model**: Fully interactive wardrobe with openable doors, drawers, and compartments
- **Multiple View Modes**: Switch between texture, wireframe, and orthographic views
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **VR/AR Support**: Full VR and AR capabilities with proper head tracking
- **Measurement Tools**: Interactive measurement system with visual guides
- **Image Gallery**: Built-in photo gallery showcasing project stages

### Technical Features
- **Real-time 3D Rendering**: High-performance WebGL rendering with shadows
- **Smooth Animations**: Tweened camera transitions and interactive animations
- **Layer Management**: Multi-layer rendering system for complex scenes
- **Grid System**: Optional grid overlay for spatial reference
- **Gizmo Controls**: 3D navigation helpers for better user experience

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern React with latest features
- **Next.js 15** - Full-stack React framework with Turbopack
- **TypeScript** - Type-safe development
- **Sass** - CSS preprocessing with modules

### 3D Graphics
- **Three.js** - Core 3D graphics library
- **React Three Fiber** - React renderer for Three.js
- **React Three Drei** - Useful helpers and abstractions
- **React Three XR** - VR/AR support
- **Tween.js** - Smooth animations

### UI Components
- **Ant Design** - Professional UI component library
- **React Image Gallery** - Photo gallery functionality

### Development Tools
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting
- **Yarn** - Package management

## 📁 Project Structure

```
app/
├── components/
│   ├── Scene.tsx          # Main 3D scene with camera controls
│   ├── Wardrobe.tsx       # Interactive wardrobe model
│   ├── Mesh.tsx           # Custom mesh component with measurement
│   └── LineHint.tsx       # Measurement line hints
├── contexts/
│   └── AppContext.tsx     # Global state management
├── hooks/
│   ├── useEventListener.ts
│   └── useNonInitialEffect.ts
├── Intro.tsx              # Landing page with project info
├── App.tsx                # Main application component
└── *.module.scss          # Component-specific styles
```

## 🎮 Controls & Navigation

### Desktop Controls
- **Mouse**: Orbit around the wardrobe
- **Scroll**: Zoom in/out
- **Click**: Interact with doors and drawers
- **Keyboard**: Layer switching (0-3)

### Mobile Controls
- **Touch**: Pan and zoom gestures
- **Tap**: Interact with wardrobe elements
- **Swipe**: Navigate image gallery

### VR/AR Controls
- **Head Movement**: Natural head tracking
- **Controllers**: Hand tracking for interactions
- **Teleportation**: Move around the scene

## 🔧 Development

### Prerequisites
- Node.js 18+
- Yarn package manager

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd wardrobe

# Install dependencies
yarn install

# Start development server
yarn dev
```

### Available Scripts
```bash
yarn dev          # Start development server (port 4000)
yarn build         # Build for production
yarn start         # Start production server (port 4001)
yarn lint          # Run ESLint
yarn deploy        # Deploy to production
```

### Environment Variables
```env
NEXT_PUBLIC_BASEPATH=/your-base-path  # Optional base path for assets
```

## 🎨 Customization

### Adding New Wardrobe Models
1. Place GLB files in `/public/models/`
2. Update the model path in `Wardrobe.tsx`
3. Adjust materials and animations as needed

### Styling
- Component styles: `*.module.scss` files
- Global styles: `App.module.scss`
- Responsive breakpoints: 768px (tablet), 480px (mobile)

### State Management
The application uses React Context for state management:
- `wireframe`: Toggle wireframe mode
- `orthographic`: Switch camera projection
- `grid`: Show/hide grid overlay
- `hideFronts`: Hide wardrobe fronts
- `layer`: Current rendering layer (0-3)
- `view`: Camera view state
- `gizmo`: Show navigation gizmo

## 📱 Responsive Design

### Breakpoints
- **Desktop**: > 768px - Full feature set
- **Tablet**: ≤ 768px - Optimized layout
- **Mobile**: ≤ 480px - Touch-optimized interface

### Mobile Optimizations
- Touch-friendly controls
- Responsive typography
- Optimized 3D performance
- Full-screen VR support

## 🚧 Roadmap

### Must Have
- [x] Texture/solid/wireframe mode
- [ ] Camera animations on site scroll
- [ ] Project stages navigation
- [ ] Wardrobe-only renders
- [ ] Full room renders

### Nice to Have
- [ ] HDR environment mapping
- [ ] Interior lighting system
- [ ] Disassembly animations
- [ ] Advanced measurement tools

### Optional
- [ ] Smooth scroll integration
- [ ] Video rendering capabilities
- [ ] Advanced vertex measurement tools

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🔗 Links

- [Live Demo](https://drygiel.github.io/wardrobe/)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [React Three Drei](https://github.com/pmndrs/drei)

