# Barangay-Based Assistance Programs

## Overview
The system now supports configuring which barangays in Tumauini, Isabela can receive specific assistance programs.

## Features
- All 46 barangays of Tumauini, Isabela are pre-loaded
- Select specific barangays for each assistance program
- If no barangays are selected, the program is available to all barangays
- Easy "Select All" and "Clear All" options

## Setup Instructions

1. Run the migrations:
```bash
php artisan migrate
```

2. Seed the barangays:
```bash
php artisan db:seed --class=BarangaySeeder
```

Or run all seeders:
```bash
php artisan db:seed
```

## Barangays in Tumauini, Isabela (46 total)
- Annafunan
- Antagan I
- Antagan II
- Banig
- Bayabo
- Bintawan
- Caligayan
- Carpentero
- Cumabao
- Dadda
- Dangan
- Fugu
- Lacab
- Lingaling
- Malamag
- Malannao
- Maligaya
- Minanga
- Mozzozzin Norte
- Mozzozzin Sur
- Namnama
- Paragu
- Pengue
- Pilitan
- Poblacion I
- Poblacion II
- Poblacion III
- Poblacion IV
- Quezon
- Rugao
- San Andres
- San Bernardo
- San Fermin
- San Isidro
- San Manuel
- San Mateo
- San Pablo
- San Vicente
- Santor
- Sima
- Sinippil
- Sisim
- Terere
- Ugad
- Uleg
- Yumangit

## Usage

### Creating/Editing Assistance Programs
1. Go to Assistance Programs
2. Click "+ New Program" or edit an existing program
3. Fill in the program details
4. In the "Target Barangays" section:
   - Check specific barangays to limit the program to those areas
   - Use "Select All" to include all barangays
   - Use "Clear All" to make it available to all barangays (no restrictions)
5. Save the program

### Viewing Programs
- The index page shows how many barangays are selected for each program
- The show page displays all selected barangays as tags
- If no barangays are selected, it shows "All"

## Database Structure

### Tables Created
- `barangays` - Stores all barangays
- `assistance_barangays` - Links assistance programs to specific barangays

### Models
- `Barangay` - Barangay model
- `FinancialAssistance` - Updated with barangays relationship

## Notes
- Empty barangay selection = program available to all barangays
- You can modify barangay status using the `is_active` field
- The system is designed for Tumauini, Isabela but can be extended to other municipalities
