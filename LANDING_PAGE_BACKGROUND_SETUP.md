# Landing Page Background Setup

## Steps to Add Municipal Hall Background Image

### 1. Save the Image
1. Save the Tumauini Municipal Hall image
2. Rename it to: `tumauini-hall.jpg`
3. Place it in: `c:\xampp\htdocs\geofarm_is\public\images\tumauini-hall.jpg`

### 2. Directory Structure
```
public/
  └── images/
      └── tumauini-hall.jpg  ← Place image here
```

### 3. What Was Changed

#### Landing Page Updated
**File:** `resources/js/Pages/Landing.jsx`

**Changes Made:**
- Hero section now uses Municipal Hall as background
- Added dark overlay (60-70% opacity) for text readability
- Text changed to white for better contrast
- Stats cards now have frosted glass effect
- Buttons updated with better contrast on dark background
- "Information Management" text changed to light green (#90EE90)

#### New Features:
- Full-width hero background image
- Responsive image that covers entire section
- Gradient overlay from black/60% to black/70%
- Backdrop blur effects on badges and stat cards
- Drop shadows on text for better readability

### 4. Alternative Image Options

If the image is too large, you can optimize it:

```cmd
# Using ImageMagick (if installed)
magick tumauini-hall.jpg -resize 1920x -quality 85 tumauini-hall.jpg

# Or use online tools:
# - TinyPNG.com
# - Compressor.io
# - Squoosh.app
```

Recommended size: 1920x1080 or 2560x1440, under 500KB

### 5. CSS Classes Used

```css
/* Background Image */
- w-full h-full object-cover (fills container, maintains aspect ratio)

/* Overlay */
- bg-gradient-to-b from-black/60 via-black/50 to-black/70
  (gradient overlay for readability)

/* Text Styling */
- text-white (white text on dark background)
- drop-shadow-lg (makes text stand out)
- text-[#90EE90] (light green accent color)

/* Glassmorphism Effects */
- bg-white/20 backdrop-blur-md (frosted glass effect)
- border-white/30 (subtle borders)
```

### 6. Viewing the Changes

After placing the image:

```cmd
# Method 1: Just refresh (if dev server is running)
npm run dev
# Then visit: http://127.0.0.1:8000

# Method 2: Build for production
npm run build
# Then refresh browser with Ctrl + Shift + R
```

### 7. Customization Options

#### Adjust Overlay Darkness
In `Landing.jsx`, change this line:
```jsx
<div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70"></div>
```

Options:
- Lighter: `from-black/40 via-black/30 to-black/50`
- Darker: `from-black/70 via-black/60 to-black/80`
- Solid: `from-black/60 to-black/60`

#### Change Text Colors
```jsx
// Current (white with green accent)
<span className="block text-[#90EE90]">Information Management</span>

// Yellow accent
<span className="block text-yellow-300">Information Management</span>

// Keep original green
<span className="block text-[#006400]">Information Management</span>
```

#### Adjust Image Position
```jsx
// Current (centered)
<img className="w-full h-full object-cover" />

// Focus on top
<img className="w-full h-full object-cover object-top" />

// Focus on bottom
<img className="w-full h-full object-cover object-bottom" />
```

### 8. Troubleshooting

#### Image Not Showing
1. Check file path: `public/images/tumauini-hall.jpg`
2. Check file name (case-sensitive)
3. Hard refresh browser: `Ctrl + Shift + R`
4. Check browser console (F12) for errors

#### Image Too Dark/Light
Adjust overlay opacity in the gradient (see Customization Options above)

#### Text Hard to Read
1. Increase overlay darkness
2. Add more drop shadow to text
3. Increase text size

#### Slow Loading
1. Optimize image size (recommended under 500KB)
2. Consider using WebP format instead of JPG
3. Add lazy loading (already implemented with object-cover)

### 9. Alternative Image Formats

#### Using WebP (Better compression)
```jsx
<img 
    src="/images/tumauini-hall.webp" 
    alt="Tumauini Municipal Hall" 
    className="w-full h-full object-cover"
/>
```

#### Using Multiple Formats (Fallback)
```jsx
<picture>
    <source srcSet="/images/tumauini-hall.webp" type="image/webp" />
    <source srcSet="/images/tumauini-hall.jpg" type="image/jpeg" />
    <img 
        src="/images/tumauini-hall.jpg" 
        alt="Tumauini Municipal Hall" 
        className="w-full h-full object-cover"
    />
</picture>
```

### 10. Final Result

Your landing page will now feature:
- ✅ Tumauini Municipal Hall as hero background
- ✅ Professional dark overlay for readability
- ✅ White text with light green accents
- ✅ Frosted glass stat cards
- ✅ Modern, eye-catching design
- ✅ Fully responsive on all devices

---

**Status:** Ready to use once image is placed
**Last Updated:** August 6, 2026
