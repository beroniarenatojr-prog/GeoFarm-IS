# GIS Mapping - Quick Start Guide

## 🚀 Getting Started

### Step 1: Access the GIS Map
1. Login to GeoFarm-IS
2. Click **"GIS Map"** in the sidebar menu (🗺️ icon)

### Step 2: Draw Your First Farm Boundary

#### For Admin/Staff Users:

1. **Select a Parcel**
   ```
   - Use the dropdown at the top
   - Choose: "Parcel #X - Farmer Name (Barangay)"
   ```

2. **Start Drawing**
   ```
   - Click the polygon tool (⬟) on the right side of the map
   - Click on the map to add corner points
   - Continue clicking to outline the farm boundary
   - Double-click the last point OR click the first point to finish
   ```

3. **Save Automatically**
   ```
   - The boundary saves automatically when you finish
   - You'll see a green "Farm boundary saved!" message
   - The boundary turns green on the map
   ```

### Step 3: View Parcel Information
```
- Click any green boundary on the map
- A popup shows:
  ✓ Parcel number
  ✓ Farmer name
  ✓ Barangay
  ✓ Area in hectares
```

### Step 4: Edit a Boundary (Admin/Staff)
```
1. Click the edit tool (✏️) on the right
2. Click "Edit Layers" button
3. Click the boundary you want to edit
4. Drag the corner points to adjust
5. Click "Save" to update
```

### Step 5: Delete a Boundary (Admin only)
```
1. Click the delete tool (🗑️) on the right
2. Click "Delete Layers" button
3. Click the boundary you want to remove
4. Click "Save" to confirm deletion
```

## 📍 Map Controls

### Drawing Tools (Right Side)
- **⬟ Polygon** - Draw new farm boundary
- **✏️ Edit** - Modify existing boundaries
- **🗑️ Delete** - Remove boundaries
- **💾 Save** - Confirm changes
- **❌ Cancel** - Discard changes

### Map Navigation
- **Mouse Wheel** - Zoom in/out
- **Click + Drag** - Pan the map
- **+ / -** - Zoom buttons (top left)

## 🎨 Color Legend

| Color | Meaning |
|-------|---------|
| 🟢 Green | Existing farm boundaries |
| 🔵 Blue | New boundary being drawn |
| 🔴 Red | Error (overlapping lines) |

## ⚠️ Common Issues

### "Please select a parcel first"
- **Solution:** Choose a parcel from the dropdown before drawing

### Boundary not saving
- **Check:** You have 'edit parcels' permission
- **Check:** Parcel is selected
- **Check:** Polygon is complete (no open lines)

### Can't see drawing tools
- **Reason:** You're logged in as Viewer (read-only)
- **Solution:** Login as Admin or Staff

### Map tiles not loading
- **Check:** Internet connection
- **Wait:** Tiles may take a few seconds to load

## 💡 Tips & Best Practices

### Drawing Accurate Boundaries
1. **Zoom in** before drawing for better precision
2. **Use satellite view** (if available) to see actual farm edges
3. **Add more points** for irregular shapes
4. **Fewer points** for rectangular farms

### Organizing Your Work
1. **Draw one parcel at a time** - Select, draw, verify
2. **Check the popup** after drawing to confirm correct parcel
3. **Use consistent zoom level** for similar-sized farms
4. **Save frequently** - Each boundary saves automatically

### Quality Control
1. **Review boundaries** by clicking them
2. **Edit if needed** - Use edit tool to adjust
3. **Verify farmer name** matches the actual farm
4. **Check area** - Compare with recorded hectares

## 📊 Viewing Statistics

After drawing boundaries, you can:
- View all parcels on the map at once
- Click individual boundaries for details
- Export parcel data with geometry
- Generate reports with mapped parcels

## 🔐 Permission Levels

| User Role | Can View | Can Draw | Can Edit | Can Delete |
|-----------|----------|----------|----------|------------|
| Super Admin | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Staff | ✅ | ✅ | ✅ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ |

## 📱 Mobile Use

The GIS map works on mobile devices:
- **Touch to pan** - Drag with one finger
- **Pinch to zoom** - Use two fingers
- **Tap to draw** - Tap points for polygon
- **Double-tap** - Complete the polygon

## 🆘 Need Help?

1. **Read the instructions** on the map page
2. **Check the legend** for color meanings
3. **Try the test parcel** first
4. **Contact system admin** if issues persist

---

**Quick Reference:**
- Menu: Sidebar → GIS Map
- Select: Dropdown → Choose parcel
- Draw: Polygon tool → Click points → Double-click
- View: Click boundary → See popup
- Edit: Edit tool → Drag points → Save
- Delete: Delete tool → Select → Save

**Remember:** Always select a parcel before drawing! 🎯
