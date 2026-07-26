/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Ingredient, StockRecord, ReceivingRecord, LogEntry, AppPermissions, WasteLogEntry, RnDReportEntry, Branch } from './types';
import { IngredientForm } from './components/IngredientForm';
import { StockTable } from './components/StockTable';
import { LoginForm, UserRole } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { BarReceiving } from './components/BarReceiving';
import { DailyStockCount } from './components/DailyStockCount';
import { AuditLog } from './components/AuditLog';
import { BarChecklist } from './components/BarChecklist';
import { BakeryChecklist } from './components/BakeryChecklist';
import { BakeryPlan } from './components/BakeryPlan';
import { BakeryPlanHistory } from './components/BakeryPlanHistory';
import { BarWasteReport } from './components/BarWasteReport';
import { WasteReport } from './components/WasteReport';
import { RnDReport } from './components/RnDReport';
import { PurchasingReport } from './components/PurchasingReport';
import { UserSettings } from './components/UserSettings';
import { Plus, Calendar, ChevronLeft, ChevronRight, Download, Coffee, Check, LogOut, Undo, Redo, LayoutDashboard, TableProperties, FileUp, FileDown, Printer, ChevronDown, PackageCheck, ClipboardCheck, Home, RotateCcw, History, ClipboardList, Trash2, FileText, ShoppingCart, ChefHat, Settings, Package, ChevronUp } from 'lucide-react';
import { startOfWeek, addWeeks, subWeeks, subDays, addDays, format, differenceInDays } from 'date-fns';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
import { DEFAULT_LINE_NOTIFY_SETTINGS, sendLineNotification } from './lib/lineNotify';
import { DEFAULT_DISCORD_NOTIFY_SETTINGS, sendDiscordNotification } from './lib/discordNotify';

import { Logo } from './components/Logo';

// Initial data from user request
const INITIAL_INGREDIENTS: Ingredient[] = [
  // Coffee
  { id: '1', name: 'Everyday Blend (Medium Roast)', brand: 'MOTMOT', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Coffee', minStock: 2, minOrder: 5, unit: 'ถุง', supplier: 'MOTMOT', image: 'https://picsum.photos/seed/coffee1/200/200' },
  { id: '2', name: 'Colombia Santander Supremo (Medium)', brand: 'Royce Roaster', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Coffee', minStock: 4, minOrder: 5, unit: 'ถุง', supplier: 'Royce Roaster', image: 'https://picsum.photos/seed/coffee2/200/200' },
  { id: '3', name: 'Brazil Santos (Medium to Dark)', brand: 'Royce Roaster', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Coffee', minStock: 6, minOrder: 6, unit: 'ถุง', supplier: 'Royce Roaster', image: 'https://picsum.photos/seed/coffee3/200/200' },

  // Milk & Dairy
  { id: '4', name: 'นมรสจืด Meiji Ray', brand: 'Meiji Ray', sizePerUnit: '2L x 1 ขวด', department: 'Bar', category: 'Milk & Dairy', minStock: 6, minOrder: 8, unit: 'ขวด', supplier: 'Makro', image: 'https://picsum.photos/seed/milk1/200/200' },
  { id: '5', name: 'นมรสจืด Meiji ฝาน้ำเงิน', brand: 'Meiji', sizePerUnit: '2L x 1 ขวด', department: 'Bar', category: 'Milk & Dairy', minStock: 3, minOrder: 3, unit: 'ขวด', supplier: 'Makro', image: 'https://picsum.photos/seed/milk2/200/200' },
  { id: '6', name: 'นมโอ๊ต Oatside', brand: 'OATSIDE', sizePerUnit: 'ยกลัง 1L x 6 กล่อง', department: 'Bar', category: 'Milk & Dairy', minStock: 3, minOrder: 1, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/oatmilk/200/200' },
  { id: '7', name: 'นมอัลมอนด์ 137 Degrees สูตรดั้งเดิม', brand: '137 Degrees', sizePerUnit: '1 กล่อง', department: 'Bar', category: 'Milk & Dairy', minStock: 0, minOrder: 1, unit: 'กล่อง', supplier: 'Makro', image: 'https://picsum.photos/seed/almondmilk/200/200' },
  { id: '8', name: 'ครีมเทียม คอฟฟี่เมต', brand: 'Coffeemate', sizePerUnit: 'ยกลัง 1kg x 12 ถุง', department: 'Bar', category: 'Milk & Dairy', minStock: 4, minOrder: 1, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/creamer/200/200' },
  { id: '9', name: 'นมข้นหวาน ตรามะลิ', brand: 'Mali', sizePerUnit: 'ยกลัง 2kg x 8 ถุง', department: 'Bar', category: 'Milk & Dairy', minStock: 4, minOrder: 1, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/condensedmilk/200/200' },
  { id: '10', name: 'นมข้นจืด Carnation สูตรเข้มข้น Extra', brand: 'Carnation', sizePerUnit: 'ยกลัง 1L x 12 กล่อง', department: 'Bar', category: 'Milk & Dairy', minStock: 8, minOrder: 12, unit: 'กล่อง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/evaporatedmilk/200/200' },

  // Syrups
  { id: '11', name: 'Monin Syrup (Roasted Hazelnut)', brand: 'MONIN', sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 1, minOrder: 1, unit: 'ขวด', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/syruphazelnut/200/200' },
  { id: '12', name: 'Monin Syrup (Caramel)', brand: 'MONIN', sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 1, minOrder: 1, unit: 'ขวด', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/syrupcaramel/200/200' },
  { id: '13', name: 'Monin Syrup (Peach)', brand: 'MONIN', sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 1, minOrder: 1, unit: 'ขวด', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/syruppeach/200/200' },
  { id: '14', name: 'Monin Syrup Fruit Mix (Yuzu)', brand: 'MONIN', sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 1, minOrder: 1, unit: 'ขวด', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/syrupyuzu/200/200' },
  { id: '15', name: 'Monin Syrup Fruit Mix (Passion Fruit)', brand: 'MONIN', sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 1, minOrder: 1, unit: 'ขวด', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/syruppassion/200/200' },
  { id: '16', name: 'Bickford น้ำเลมอน', brand: 'Bickfords', sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 1, minOrder: 2, unit: 'ขวด', supplier: 'Tops', image: 'https://picsum.photos/seed/lemonjuice/200/200' },
  { id: '17', name: 'น้ำเชื่อมละลายเร็ว มิตรผล', brand: 'Mitr Phol', sizePerUnit: 'ยกลัง 800ml x 12 ถุง', department: 'Bar', category: 'Syrups', minStock: 5, minOrder: 1, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/syrupclear/200/200' },
  { id: '18', name: 'ซอสคาราเมล Topping ตรา Juniper', brand: "Juniper's", sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 4, minOrder: 4, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/saucecaramel/200/200' },
  { id: '19', name: 'ซอสช็อคโกแลต Topping Hot fudge ตรา Juniper', brand: "Juniper's", sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 3, minOrder: 3, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/saucechoco/200/200' },
  { id: '20', name: 'น้ำผึ้ง', brand: '-', sizePerUnit: '1 ขวด', department: 'Bar', category: 'Syrups', minStock: 0, minOrder: 1, unit: 'ขวด', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/honey/200/200' },

  // Powders
  { id: '21', name: 'ผงโกโก้ Ghana', brand: 'X2O', sizePerUnit: '500g x 1 ถุง', department: 'Bar', category: 'Powders', minStock: 10, minOrder: 20, unit: 'ถุง', supplier: 'Unknown', image: 'https://picsum.photos/seed/cocoa/200/200' },
  { id: '22', name: 'ผงมัชฉะ สำหรับตี Clear (Okumidori)', brand: '-', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Powders', minStock: 4, minOrder: 4, unit: 'ถุง', supplier: 'Unknown', image: 'https://picsum.photos/seed/matchaclear/200/200' },
  { id: '23', name: 'ผงมัชฉะ สำหรับตี นม (Latte) (Purist)', brand: 'Peace Oriental Teahouse', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Powders', minStock: 4, minOrder: 4, unit: 'ถุง', supplier: 'Unknown', image: 'https://picsum.photos/seed/matchalatte/200/200' },
  { id: '24', name: 'ผงโฮจิฉะ Medium Firing', brand: 'Peace Oriental Teahouse', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Powders', minStock: 0, minOrder: 1, unit: 'ถุง', supplier: 'Unknown', image: 'https://picsum.photos/seed/hojicha1/200/200' },
  { id: '25', name: 'ผงโฮจิฉะ Low Firing', brand: 'Peace Oriental Teahouse', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Powders', minStock: 0, minOrder: 1, unit: 'ถุง', supplier: 'Unknown', image: 'https://picsum.photos/seed/hojicha2/200/200' },
  { id: '26', name: 'ผงชาไทย ตรามือ ถุงแดง', brand: 'ChaTraMue', sizePerUnit: 'ยกลัง x 12 ถุง', department: 'Bar', category: 'Powders', minStock: 6, minOrder: 1, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/thaiteared/200/200' },
  { id: '27', name: 'ผงชาดำ ตรามือ ถุงเหลือง', brand: 'ChaTraMue', sizePerUnit: '1 ถุง', department: 'Bar', category: 'Powders', minStock: 3, minOrder: 3, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/thaiteayellow/200/200' },
  { id: '28', name: 'ผงชาใต้ (ชาปักษ์ใต้)', brand: 'Cha Pak Tai', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Powders', minStock: 3, minOrder: 5, unit: 'ถุง', supplier: 'Unknown', image: 'https://picsum.photos/seed/southerntea/200/200' },
  { id: '29', name: 'ผงชาเข้มข้น Nestea', brand: 'Nestea', sizePerUnit: 'ยกลัง 200g x 12 ถุง', department: 'Bar', category: 'Powders', minStock: 4, minOrder: 1, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/nestea/200/200' },
  { id: '30', name: 'ผงชาพีช Bon café', brand: 'Boncafe', sizePerUnit: '1kg x 1 ถุง', department: 'Bar', category: 'Powders', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/peachtea/200/200' },

  // Others (Beverages)
  { id: '31', name: 'น้ำมะพร้าว Coco max', brand: 'Cocomax', sizePerUnit: 'ยกลัง 350ml x 24 ขวด', department: 'Bar', category: 'Others', minStock: 10, minOrder: 24, unit: 'ขวด', supplier: 'Makro', image: 'https://picsum.photos/seed/coconutoil/200/200' },
  { id: '32', name: 'โซดาสิงห์', brand: 'Singha', sizePerUnit: 'ยกลัง x 24 ขวด', department: 'Bar', category: 'Others', minStock: 10, minOrder: 24, unit: 'ขวด', supplier: 'Makro', image: 'https://picsum.photos/seed/soda/200/200' },
  { id: '33', name: 'น้ำช่อดอกมะพร้าว Ha-Young', brand: 'Hayoung', sizePerUnit: 'ยกลัง x 28 ขวด', department: 'Bar', category: 'Others', minStock: 8, minOrder: 28, unit: 'ขวด', supplier: 'Unknown', image: 'https://picsum.photos/seed/coconutflower/200/200' },
  { id: '34', name: 'Malee น้ำส้มเขียวหวาน พาสเจอร์ไรซ์', brand: 'Malee', sizePerUnit: '2 กล่อง', department: 'Bar', category: 'Others', minStock: 0, minOrder: 2, unit: 'กล่อง', supplier: 'Makro', image: 'https://picsum.photos/seed/orangejuice/200/200' },
  { id: '35', name: 'TIPCO น้ำส้ม Squeeze Shogun', brand: 'TIPCO', sizePerUnit: '2 กล่อง', department: 'Bar', category: 'Others', minStock: 0, minOrder: 2, unit: 'กล่อง', supplier: 'Makro', image: 'https://picsum.photos/seed/tipco/200/200' },
  { id: '36', name: 'Brook เนื้อ พีชในน้ำเชื่อม', brand: 'Brook', sizePerUnit: '1 กระป๋อง', department: 'Bar', category: 'Others', minStock: 1, minOrder: 2, unit: 'กระป๋อง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/cannedpeach/200/200' },
  { id: '37', name: 'น้ำแร่ออร่า', brand: 'Aura', sizePerUnit: '1 แพ็ค x 8 ขวด', department: 'Bar', category: 'Others', minStock: 12, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/mineralwater/200/200' },

  // Packaging
  { id: '38', name: 'แก้วร้อน 8 Oz.', brand: '-', sizePerUnit: '1 แถว / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 3, minOrder: 10, unit: 'แถว', supplier: 'Unknown', image: 'https://picsum.photos/seed/cup8oz/200/200' },
  { id: '39', name: 'ฝาแก้วร้อน 8 Oz.', brand: '-', sizePerUnit: '1 แถว / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 3, minOrder: 10, unit: 'แถว', supplier: 'Unknown', image: 'https://picsum.photos/seed/lid8oz/200/200' },
  { id: '40', name: 'แก้ว 12 Oz.', brand: 'PET', sizePerUnit: '1 แถว / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 15, minOrder: 30, unit: 'แถว', supplier: 'Unknown', image: 'https://picsum.photos/seed/cup12oz/200/200' },
  { id: '41', name: 'ฝาแก้ว 12 Oz.', brand: '-', sizePerUnit: '1 แถว / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 15, minOrder: 30, unit: 'แถว', supplier: 'Unknown', image: 'https://picsum.photos/seed/lid12oz/200/200' },
  { id: '42', name: 'แก้ว 16 Oz.', brand: 'FC', sizePerUnit: '1 แถว / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 15, minOrder: 30, unit: 'แถว', supplier: 'Unknown', image: 'https://picsum.photos/seed/cup16oz/200/200' },
  { id: '43', name: 'ฝาแก้ว 16 Oz.', brand: '-', sizePerUnit: '1 แถว / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 15, minOrder: 30, unit: 'แถว', supplier: 'Unknown', image: 'https://picsum.photos/seed/lid16oz/200/200' },
  { id: '44', name: 'หลอดร้อน', brand: '-', sizePerUnit: '1 แพ็ค / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 1, minOrder: 3, unit: 'แพ็ค', supplier: 'Shopee', image: 'https://picsum.photos/seed/strawhot/200/200' },
  { id: '45', name: 'หลอด 6 mm', brand: '-', sizePerUnit: '1 แพ็ค / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 10, minOrder: 16, unit: 'แพ็ค', supplier: 'Shopee', image: 'https://picsum.photos/seed/straw6mm/200/200' },
  { id: '46', name: 'หลอด 8 mm', brand: '-', sizePerUnit: '1 แพ็ค / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 10, minOrder: 16, unit: 'แพ็ค', supplier: 'Shopee', image: 'https://picsum.photos/seed/straw8mm/200/200' },
  { id: '47', name: 'ขวดแยกน้ำแบบเหลี่ยม 250 ml', brand: '-', sizePerUnit: '1 แพ็ค / 150 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 1, minOrder: 3, unit: 'แพ็ค', supplier: 'ตี๋ผลไม้ดอง', image: 'https://picsum.photos/seed/bottle250/200/200' },
  { id: '48', name: 'ถุงใส่แก้วน้ำ สายเดี่ยว', brand: '-', sizePerUnit: '100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 1, minOrder: 3, unit: 'แพ็ค', supplier: 'ตี๋ผลไม้ดอง', image: 'https://picsum.photos/seed/bag1/200/200' },
  { id: '49', name: 'ถุงใส่แก้วน้ำ คู่', brand: '-', sizePerUnit: '100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 1, minOrder: 3, unit: 'แพ็ค', supplier: 'ตี๋ผลไม้ดอง', image: 'https://picsum.photos/seed/bag2/200/200' },
  { id: '50', name: 'แก้วน้ำพลาสติกสำหรับลูกค้า 6 oz', brand: '-', sizePerUnit: '1 ลัง / 40 แพ็ค', department: 'Bar', category: 'Packaging', minStock: 5, minOrder: 1, unit: 'ลัง', supplier: 'ตี๋ผลไม้ดอง', image: 'https://picsum.photos/seed/cup6oz/200/200' },
  { id: '51', name: 'ช้อนไม้', brand: '-', sizePerUnit: '1 แพ็ค / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 20, minOrder: 20, unit: 'แพ็ค', supplier: 'Shopee', image: 'https://picsum.photos/seed/spoon/200/200' },
  { id: '52', name: 'กล่อง Bakery เค้กเดียว สี Matcha', brand: '-', sizePerUnit: '40 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 20, minOrder: 20, unit: 'แพ็ค', supplier: 'Boxlicious', image: 'https://picsum.photos/seed/boxmatcha1/200/200' },
  { id: '53', name: 'กล่อง Bakery Snack XS สี Matcha', brand: '-', sizePerUnit: '40 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 20, minOrder: 20, unit: 'แพ็ค', supplier: 'Boxlicious', image: 'https://picsum.photos/seed/boxmatchaxs/200/200' },
  { id: '54', name: 'กระดาษรองในกล่องขนม Bakery', brand: '-', sizePerUnit: '100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 20, minOrder: 20, unit: 'แพ็ค', supplier: 'Shopee', image: 'https://picsum.photos/seed/paperbakery/200/200' },
  { id: '55', name: 'กล่อง Bakery Snack L สี Matcha', brand: '-', sizePerUnit: '40 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 20, minOrder: 20, unit: 'แพ็ค', supplier: 'Boxlicious', image: 'https://picsum.photos/seed/boxmatchal/200/200' },
  { id: '56', name: 'ถุงขนมปังคราฟท์ เบอร์ 8', brand: '-', sizePerUnit: '50 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 2, minOrder: 4, unit: 'แพ็ค', supplier: 'ตี๋ผลไม้ดอง', image: 'https://picsum.photos/seed/kraftbag8/200/200' },
  { id: '57', name: 'ถุงกระดาษใส่ Bakery', brand: '-', sizePerUnit: '1 แพ็ค / 100 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 10, minOrder: 20, unit: 'แพ็ค', supplier: 'Shopee', image: 'https://picsum.photos/seed/paperbagbakery/200/200' },
  { id: '58', name: 'ถุงหิ้วใส LL 12" x 20"', brand: '-', sizePerUnit: '20 แพ็ค / 10 kg', department: 'Bar', category: 'Packaging', minStock: 10, minOrder: 20, unit: 'แพ็ค', supplier: 'ตี๋ผลไม้ดอง', image: 'https://picsum.photos/seed/bagll1220/200/200' },
  { id: '59', name: 'ถุงหิ้วใส LL 8" x 16"', brand: '-', sizePerUnit: '20 แพ็ค / 10 kg', department: 'Bar', category: 'Packaging', minStock: 10, minOrder: 20, unit: 'แพ็ค', supplier: 'ตี๋ผลไม้ดอง', image: 'https://picsum.photos/seed/bagll816/200/200' },
  { id: '60', name: 'ถุงหิ้วใส LL 15" x 22"', brand: '-', sizePerUnit: '20 แพ็ค / 10 kg', department: 'Bar', category: 'Packaging', minStock: 0, minOrder: 2, unit: 'แพ็ค', supplier: 'ตี๋ผลไม้ดอง', image: 'https://picsum.photos/seed/bagll1522/200/200' },
  { id: '61', name: 'ถุงมือยางสำหรับหยิบขนม size M', brand: '-', sizePerUnit: '1 กล่อง', department: 'Bar', category: 'Packaging', minStock: 2, minOrder: 4, unit: 'กล่อง', supplier: 'Shopee', image: 'https://picsum.photos/seed/glovesm/200/200' },
  { id: '62', name: 'ถุงซิปใส (ใส่น้ำแข็ง)', brand: '-', sizePerUnit: '1 แพ็ค / 175 ชิ้น', department: 'Bar', category: 'Packaging', minStock: 0, minOrder: 1, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/zipbag/200/200' },

  // Supplies
  { id: '63', name: 'กระดาษ POS', brand: '-', sizePerUnit: '1 ม้วน', department: 'Bar', category: 'Supplies', minStock: 10, minOrder: 20, unit: 'ม้วน', supplier: 'Shopee', image: 'https://picsum.photos/seed/pospaper/200/200' },
  { id: '64', name: 'พลาสติก wrap ใส ยี่ห้อ ARO', brand: 'ARO', sizePerUnit: '-', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 0, unit: 'ม้วน', supplier: 'Makro', image: 'https://picsum.photos/seed/wrap/200/200' },
  { id: '65', name: 'Sticker Crenn', brand: '-', sizePerUnit: '-', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 0, unit: '-', supplier: 'แซน', image: 'https://picsum.photos/seed/sticker/200/200' },
  { id: '66', name: 'ถุงขยะดำใหญ่ 28"x36"', brand: '-', sizePerUnit: '-', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 0, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/trashbagbig/200/200' },
  { id: '67', name: 'ถุงขยะห้องน้ำ 18"x20"', brand: '-', sizePerUnit: '-', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 0, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/trashbagsmall/200/200' },
  { id: '68', name: 'ถุงใส่กากกาแฟ', brand: '-', sizePerUnit: '-', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 0, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/coffeebag/200/200' },
  { id: '69', name: 'กระดาษชำระ 24 ม้วน (ห้องน้ำ) Zilk', brand: 'Zilk', sizePerUnit: '1 แพ็ค / 24 ม้วน', department: 'Bar', category: 'Supplies', minStock: 6, minOrder: 1, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/toiletpaper/200/200' },
  { id: '70', name: 'กระดาษเช็ดปาก 33x33 ซม. สีน้ำตาล ARO', brand: 'ARO', sizePerUnit: '1 แพ็ค / 500 แผ่น', department: 'Bar', category: 'Supplies', minStock: 1, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/napkin/200/200' },
  { id: '71', name: 'โฟมล้างมือ Kirei', brand: 'Kirei', sizePerUnit: 'ยกแพ็ค 200ml x 2 ถุง', department: 'Bar', category: 'Supplies', minStock: 1, minOrder: 1, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/handsoap/200/200' },
  { id: '72', name: 'น้ำยาล้างจาน ซันไลท์', brand: 'Sunlight', sizePerUnit: '3.2L / แกลอน', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 1, unit: 'แกลอน', supplier: 'Makro', image: 'https://picsum.photos/seed/dishsoap/200/200' },
  { id: '73', name: 'น้ำยาซักผ้า ARO', brand: 'ARO', sizePerUnit: '3.5L / แกลอน', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 1, unit: 'แกลอน', supplier: 'Makro', image: 'https://picsum.photos/seed/detergent/200/200' },
  { id: '74', name: 'น้ำยาล้างห้องน้ำ Vixol', brand: 'Vixol', sizePerUnit: 'ยกแพ็ค 900ml x 3 ขวด', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 0, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/toiletcleaner/200/200' },
  { id: '75', name: 'น้ำยาทำความสะอาดพื้น ARO', brand: 'ARO', sizePerUnit: '5.2L / แกลอน', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 1, unit: 'แกลอน', supplier: 'Makro', image: 'https://picsum.photos/seed/floorcleaner/200/200' },
  { id: '76', name: 'น้ำยาเช็ดกระจก Mr.Muscle', brand: 'Mr.Muscle', sizePerUnit: '5L / แกลอน', department: 'Bar', category: 'Supplies', minStock: 0, minOrder: 1, unit: 'แกลอน', supplier: 'Makro', image: 'https://picsum.photos/seed/glasscleaner/200/200' },
  { id: '77', name: 'ฟองน้ำล้างจาน Scotch Brite', brand: 'Scotch Brite', sizePerUnit: 'ยกแพ็ค x 3 ชิ้น', department: 'Bar', category: 'Supplies', minStock: 1, minOrder: 1, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/sponge/200/200' },
  { id: '78', name: 'ผ้าฟองน้ำอเนกประสงค์ Scotch Brite', brand: 'Scotch Brite', sizePerUnit: 'ยกแพ็ค x 4 ชิ้น', department: 'Bar', category: 'Supplies', minStock: 1, minOrder: 1, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/spongecloth/200/200' },
  { id: '79', name: 'เกลด เจลหอมปรับอากาศ', brand: 'Glade', sizePerUnit: 'ยกแพ็ค 180g x 3 ชิ้น', department: 'Bar', category: 'Supplies', minStock: 1, minOrder: 1, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/airfreshener/200/200' },
  { id: 'b-90852e', name: 'น้ำตาลทรายขาว', brand: 'ลิน', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 1, minOrder: 1, unit: 'กระสอบ', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-7d19dd', name: 'บลูเบอร์รี่ สด', brand: '-', sizePerUnit: '1 กล่อง (125กรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 5, minOrder: 1, unit: 'กล่อง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-1652b1', name: 'บลูเบอร์รี่ สด', brand: '-', sizePerUnit: '1 กล่อง (125กรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 5, minOrder: 1, unit: 'กล่อง', supplier: 'GO wholesale', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-cabfee', name: 'นม 5 ลิตร', brand: 'Meji', sizePerUnit: '1 แกลลอน (5ลิตร)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 2, minOrder: 3, unit: 'แกลลอน', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-442051', name: 'นม 5 ลิตร', brand: 'Meji', sizePerUnit: '1 แกลลอน (5ลิตร)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 2, minOrder: 3, unit: 'แกลลอน', supplier: 'Meji', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-229c4f', name: 'White chocolate', brand: 'Tulip', sizePerUnit: '1 ถุง (2.5 กิโลกรัม)', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 3, unit: 'ถุง', supplier: 'GO wholesale,หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-684520', name: 'สตรอเบอรี่แช่แข็ง', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 4, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-76fc5e', name: 'บลูเบอร์รี่แช่แข็ง', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 2, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-4ae2ab', name: 'ราสเบอรี่แช่แข็ง', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-fc2009', name: 'ผักโขมแช่แข็ง', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 1, unit: 'ลัง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-dd891e', name: 'ไข่ไก่', brand: 'aro', sizePerUnit: '1 ลัง (30 ฟอง)', department: 'Bakery', category: 'เนื้อสัตว์และไข่ (Meats & Eggs)', minStock: 2, minOrder: 4, unit: 'ลัง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-4c3316', name: 'พริกจินดาเขียว', brand: 'aro', sizePerUnit: '1 กล่อง (300กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 3, unit: 'กล่อง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-7399b9', name: 'แป้ง T65', brand: 'Les Grands Moulins de Paris', sizePerUnit: '1 ถุง (25 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 3, minOrder: 5, unit: 'ถุง', supplier: 'AEP', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-543f0f', name: 'แป้ง T55', brand: 'Les Grands Moulins de Paris', sizePerUnit: '1 ถุง (25 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 3, minOrder: 5, unit: 'ถุง', supplier: 'AEP', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-93d7eb', name: 'แป้ง T45', brand: 'Les Grands Moulins de Paris', sizePerUnit: '1 ถุง (25 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 3, minOrder: 5, unit: 'ถุง', supplier: 'AEP', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-cd8786', name: 'แป้ง Wholewheat', brand: 'Moul-Bie', sizePerUnit: '1 ถุง (25 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 1, minOrder: 5, unit: 'ถุง', supplier: 'AEP', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-0a7226', name: 'แป้ง Rye', brand: 'Moul-Bie', sizePerUnit: '1 ถุง (25 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 1, minOrder: 5, unit: 'ถุง', supplier: 'AEP', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f6672a', name: 'แป้งวีนัส', brand: 'NS Venus', sizePerUnit: '1 ถุง (25 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 1, minOrder: 5, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-7feed1', name: 'ชอคโกแลตแท่ง', brand: 'Barry', sizePerUnit: '1 กล่อง', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 5, unit: 'กล่อง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-baee5f', name: 'เนยก้อน 5 กิโลกรัม', brand: 'Anchor', sizePerUnit: '1 ก้อน (5 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 1, minOrder: 3, unit: 'ก้อน', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-03bf6b', name: 'เนยแผ่น', brand: 'Anchor', sizePerUnit: '1 แผ่น (1 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 1, minOrder: 2, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-5c7882', name: 'วิปครีม', brand: 'Debic', sizePerUnit: '1 ขวด (1 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 2, minOrder: 4, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-25e653', name: 'ชีสแผ่น', brand: 'Anchor', sizePerUnit: '1 แพ็ค (1 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 2, minOrder: 2, unit: 'แพ็ค', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-a80054', name: 'ครีมชีส', brand: 'Anchor', sizePerUnit: '1 ก้อน (1 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 1, minOrder: 2, unit: 'ลัง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e40709', name: 'ชีสพาเมซาน (ตัวรอง)', brand: '-', sizePerUnit: '1 ก้อน (1 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 1, minOrder: 5, unit: 'ก้อน', supplier: 'AEP', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-57d248', name: 'ชีสพาเมซาน (ตัวหลัก)', brand: 'Belgioioso', sizePerUnit: '1 ก้อน (1 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 1, minOrder: 5, unit: 'ก้อน', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-a8bbd9', name: 'แฮม', brand: 'หมูสองตัว', sizePerUnit: '1 แพ็ค (500 กรัม)', department: 'Bakery', category: 'เนื้อสัตว์และไข่ (Meats & Eggs)', minStock: 2, minOrder: 5, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-d5a1f9', name: 'เนยมีลเมทจืดใหญ่', brand: 'Mealmate', sizePerUnit: '1 ก้อน (5 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 1, minOrder: 3, unit: 'ก้อน', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-a83d10', name: 'เนยมีลเมทเค็ม', brand: 'Mealmate', sizePerUnit: '1 กล่อง (1 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 1, minOrder: 3, unit: 'ชิ้น', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e9abff', name: 'เจลาติน', brand: 'Mcgarrett', sizePerUnit: '1 ถุง (100 กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 4, minOrder: 5, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-b0f92a', name: 'ผงซินนาม่อน', brand: 'aro', sizePerUnit: '1 ถุง (100 กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-bee27b', name: 'เกลือ', brand: 'ปรุงทิพย์', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 4, minOrder: 5, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-4ad9d4', name: 'น้ำส้มสายชู', brand: 'อสร', sizePerUnit: '1 แกลลอน (5ลิตร)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'แกลลอน', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-637137', name: 'เบกกิ้งโซดา', brand: 'Mcgarrett', sizePerUnit: '1 ถุง (100 กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-6ed3cf', name: 'ผงฟู', brand: 'Mcgarrett', sizePerUnit: '1 ถุง (100 กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-5dc216', name: 'แครกเก้อ', brand: 'Mcvities', sizePerUnit: '1 กล่อง', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 3, minOrder: 5, unit: 'กล่อง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-ce535d', name: 'เพคติน', brand: 'Apple', sizePerUnit: '1 กระปุก (250 กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'กระปุก', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-a8c533', name: 'ผงวุ้น', brand: 'นางเงือก', sizePerUnit: '1 ถุง (50กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-3d37b3', name: 'น้ำตาลไอซิ่ง', brand: 'ลิน', sizePerUnit: '1 ถุง (900กรัม)', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 3, minOrder: 1, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-980734', name: 'โกลเด้นไซรัป', brand: 'มิตรผล', sizePerUnit: '1 ถุง (800กรัม)', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 1, minOrder: 3, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-d1f771', name: 'น้ำตาลเบเกอรี่', brand: 'ลิน', sizePerUnit: '1 ถุง (1กิโลกรัม)', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 1, minOrder: 5, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-45642c', name: 'น้ำตาลทรายแดงเบเกอรี่', brand: 'มิตรผล', sizePerUnit: '1 ถุง (1กิโลกรัม)', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 3, minOrder: 0, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-2d7c33', name: 'น้ำตาลคาราเมล', brand: 'ลิน', sizePerUnit: '1 ถุง (1กิโลกรัม)', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 3, minOrder: 5, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-0ea8dd', name: 'ผงมัทฉะ เกรดเบเกอรี่', brand: 'Kyoto', sizePerUnit: '1 ถุง (100กรัม)', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 3, minOrder: 5, unit: 'ถุง', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-80358e', name: 'ผงมัทฉะ เกรดพิธีการ ทำทาร์ต', brand: 'Peace Naturalist', sizePerUnit: 'N/A', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 3, unit: 'ถุง', supplier: 'Peace', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-ff33e4', name: 'พิสตาชิโอเม็ด', brand: '-', sizePerUnit: '1 ถุง (1กิโลกรัม)', department: 'Bakery', category: 'ถั่วและธัญพืช (Nuts & Seeds)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-252fe1', name: 'พิสตาชิโอเพสท์', brand: 'OLAM', sizePerUnit: '1 ถัง (1กิโลกรัม)', department: 'Bakery', category: 'ถั่วและธัญพืช (Nuts & Seeds)', minStock: 2, minOrder: 3, unit: 'ถัง', supplier: 'Shopee', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-173778', name: 'เออเกร Earl grey', brand: 'ตราชงชา88', sizePerUnit: '1 ถุง (200กรัม)', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-3c9670', name: 'ผงโกโก้', brand: 'Tulip', sizePerUnit: '1 ถุง (440กรัม)', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-8131ec', name: 'แป้งข้าวโพด', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 2, minOrder: 3, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-099693', name: 'งาดำ', brand: 'aro', sizePerUnit: '1 ถุง (500กรัม)', department: 'Bakery', category: 'ถั่วและธัญพืช (Nuts & Seeds)', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-6af861', name: 'งาขาว', brand: 'aro', sizePerUnit: '1 ถุง (500กรัม)', department: 'Bakery', category: 'ถั่วและธัญพืช (Nuts & Seeds)', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-0f5399', name: 'อัลมอนป่น', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ถั่วและธัญพืช (Nuts & Seeds)', minStock: 4, minOrder: 5, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f0bdce', name: 'อัลมอนสไลด์', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ถั่วและธัญพืช (Nuts & Seeds)', minStock: 1, minOrder: 3, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-6df2d4', name: 'อัลมอนเต็มเมล็ด', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ถั่วและธัญพืช (Nuts & Seeds)', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-6c0d8b', name: 'วอลนัท', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ถั่วและธัญพืช (Nuts & Seeds)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-8c062a', name: 'ลูกเกดดำ', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-6771c3', name: 'ลูกเกดทอง', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-ffa33a', name: 'แป้งอเนกประสงค์', brand: 'ตรา ว่าว', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 3, minOrder: 1, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-ae3065', name: 'แป้งเค้ก', brand: 'ตรา ว่าว', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 3, minOrder: 1, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-40d42e', name: 'น้ำเลมอน (หลัก)', brand: 'Ital lemon', sizePerUnit: '1 ขวด (200กรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 3, minOrder: 1, unit: 'ขวด', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-cdb977', name: 'น้ำเลมอน (รอง)', brand: 'Ital lemon', sizePerUnit: '1 ขวด (200กรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 3, minOrder: 1, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f5e7b1', name: 'เนื้อลิ้นจี่กระป๋อง', brand: 'มาลี', sizePerUnit: '1 กระป๋อง (565กรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 2, minOrder: 1, unit: 'กระป๋อง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-d8a10e', name: 'เลมอนซันควิก', brand: 'ซันควิก', sizePerUnit: '1 ขวด (700กรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 3, minOrder: 1, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-ce32ca', name: 'ส้มซันควิก', brand: 'ซันควิก', sizePerUnit: '1 ขวด (700กรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 0, minOrder: 1, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-c3ffa3', name: 'วานิลลา Premium Vanilla flavor', brand: 'Mccormick', sizePerUnit: '1 ขวด (59กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 3, minOrder: 5, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-955df5', name: 'วานิลลา Vanilla bean paste', brand: 'Prova', sizePerUnit: '1 กระปุก (500 กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 3, unit: 'กระปุก', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-4ebb4c', name: 'น้ำมันรำข้าว', brand: 'คิง', sizePerUnit: '1 แกลลอน (5ลิตร)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'แกลลอน', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-0717ed', name: 'สเปรย์น้ำมัน', brand: 'Bakels sprink', sizePerUnit: '1 กระป๋อง (450กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 1, unit: 'กระป๋อง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-d2e518', name: 'เนื้อบด', brand: 'ประกอบบีฟ', sizePerUnit: '1 แพ็ค (1 กิโลกรัม)', department: 'Bakery', category: 'เนื้อสัตว์และไข่ (Meats & Eggs)', minStock: 0, minOrder: 4, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-db7a5d', name: 'หัวหอม', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 2, unit: 'กิโลกรัม', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-9862d9', name: 'แครอท', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 2, unit: 'กิโลกรัม', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-a02e9b', name: 'มะเขือเทศกระป๋อง', brand: 'Fiamma', sizePerUnit: '1 กระป๋อง (400กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 4, unit: 'กระป๋อง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f69323', name: 'ไวน์แดง', brand: 'Lake ville', sizePerUnit: '1 ขวด (700กรัม)', department: 'Bakery', category: 'เครื่องดื่มแอลกอฮอล์ (Alcoholic Beverages)', minStock: 1, minOrder: 2, unit: 'ขวด', supplier: 'Lotus', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-37140d', name: 'ผงชูรส', brand: 'อายิโนะโมโตะ', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-014c16', name: 'โฮจิฉะ ใช้โรยตกแต่ง', brand: 'Kawami', sizePerUnit: '1 ถุง (100 กรัม)', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-b8dd10', name: 'โฮจิฉะ ใช้ทำganache', brand: 'Peace', sizePerUnit: 'N/A', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Peace', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-1ebed4', name: 'สีผสมอาหาร สีชมพู', brand: 'วินเนอร์', sizePerUnit: '1 ขวด (30กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f86b25', name: 'สีผสมอาหาร สีน้ำตาล', brand: 'วินเนอร์', sizePerUnit: '1 ขวด (30กรัม)', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 1, minOrder: 2, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-3e62c4', name: 'สีผสมอาหาร สีม่วง', brand: 'วินเนอร์', sizePerUnit: '1 ขวด (30กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-52071e', name: 'กลิ่นกุหลาบ', brand: 'The one', sizePerUnit: '1 ขวด (60กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ขวด', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f08366', name: 'Parsley พาร์สลีย์', brand: '-', sizePerUnit: '1 ถุง (50กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-25c5e8', name: 'นมผง', brand: 'Dairy rich', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 3, minOrder: 5, unit: 'ถุง', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-66a758', name: 'Trimoline ทรีโมลีน (inverted sugar)', brand: '-', sizePerUnit: '1 ถัง (11กิโลกรัม)', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 1, minOrder: 1, unit: 'ถัง', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-95f7d0', name: 'ดอกกุหลาบอบแห้ง', brand: '-', sizePerUnit: '1 ถุง (50กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 2, minOrder: 1, unit: 'ถุง', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-3ae1e7', name: 'ชาลาเวนเดอร์', brand: 'Guru tea', sizePerUnit: '1 ถุง (500กรัม)', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'Shopee', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-7d050f', name: 'ยีสสด', brand: 'SAF', sizePerUnit: '1 ก้อน (500กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 4, minOrder: 5, unit: 'ก้อน', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-d99cc6', name: 'ยีสแช่แข็ง', brand: 'SAF', sizePerUnit: '1 ถุง (3500กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 1, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f28f26', name: 'กาแฟสำเร็จรูป', brand: 'Nescafe', sizePerUnit: '1 ถุง (100กรัม)', department: 'Bakery', category: 'ช็อกโกแลตและชา (Chocolate & Tea)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e4b691', name: 'มิ๊กเบอรี่แช่แข็ง', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 4, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f3f3b7', name: 'แป้ง campagrain', brand: 'Moul-Bie', sizePerUnit: '1 ถุง (25 กิโลกรัม)', department: 'Bakery', category: 'แป้ง (Flours)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'AEP', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-c6ddcf', name: 'เลดี้ฟิงเก้อ', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'หนมตุน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-eb9b21', name: 'ดอกเกลือ', brand: 'salte', sizePerUnit: '1 ถัง (350 กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 2, unit: 'ถัง', supplier: 'Shopee', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-4eb74e', name: 'อินทผาลัม', brand: 'fruit mania', sizePerUnit: 'N/A', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 1, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e68452', name: 'โกโก้บัตเตอร์', brand: 'Barry,callebaut', sizePerUnit: 'N/A', department: 'Bakery', category: 'ผลิตภัณฑ์นม (Dairy)', minStock: 1, minOrder: 3, unit: 'ถุง', supplier: 'AEP,นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-a8cf79', name: 'พีชแช่แข็ง', brand: 'aro', sizePerUnit: '1 ถุง (1 กิโลกรัม)', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 4, minOrder: 1, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f5c26b', name: 'กรดมะนาว', brand: 'mcgarrett', sizePerUnit: 'N/A', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 1, minOrder: 3, unit: 'ถุง', supplier: 'Makro,นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-c14dd0', name: 'พริกชี้ฟ้าเขียว', brand: '-', sizePerUnit: '1 กล่อง (300 กรัม)', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 3, unit: 'กล่อง', supplier: 'makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-6557ac', name: 'หัวไหล่หมู', brand: '-', sizePerUnit: '1 กิโลกรัม', department: 'Bakery', category: 'เนื้อสัตว์และไข่ (Meats & Eggs)', minStock: 0, minOrder: 4, unit: 'กิโลกรัม', supplier: 'makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-9de563', name: 'น้ำส้ม', brand: 'กรีนการ์เด้น', sizePerUnit: '1 ขวด 1000 กรัม', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 1, minOrder: 2, unit: 'ขวด', supplier: 'makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-08e24c', name: 'น้ำมะนาว', brand: 'ฟ้าไทย', sizePerUnit: '1 ขวด 1000 กรัม', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 1, minOrder: 3, unit: 'ขวด', supplier: 'makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-0cbcdc', name: 'ยี่หร่า', brand: 'aro', sizePerUnit: 'N/A', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f09149', name: 'ออริกาโน่', brand: 'aro', sizePerUnit: 'N/A', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-0b12a0', name: 'กระเทียม', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-af9f45', name: 'มัสตาร์ด', brand: 'frenchs', sizePerUnit: 'N/A', department: 'Bakery', category: 'วัตถุดิบเสริม/เครื่องปรุง (Seasonings & Additives)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-d0041d', name: 'แตงกวาดอง', brand: 'ken', sizePerUnit: 'N/A', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: 'aep', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-74c0fc', name: 'เมเปิ้ลไซรัป', brand: 'emperial', sizePerUnit: 'N/A', department: 'Bakery', category: 'น้ำตาลและไซรัป (Sugar & Syrups)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-9ae9cb', name: 'ดาร์คช้อคโกแลต', brand: 'van houten', sizePerUnit: 'N/A', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f05a72', name: 'ไวท์ช้อคโกแลต', brand: 'van houten', sizePerUnit: 'N/A', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e49721', name: 'เลมอนสด', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-08676d', name: 'พีชเข้มข้น', brand: 'tenju', sizePerUnit: 'N/A', department: 'Bakery', category: 'ผลไม้ (Fruits)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-806615', name: 'สัปปะรดกระป๋อง', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-806575', name: 'เบคอนกรอบ', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'เนื้อสัตว์และไข่ (Meats & Eggs)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-cbd2f1', name: 'เหล้ารัม', brand: 'แสงโสม', sizePerUnit: 'N/A', department: 'Bakery', category: 'เครื่องดื่มแอลกอฮอล์ (Alcoholic Beverages)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-528436', name: 'เหล้าเบลิส', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'เครื่องดื่มแอลกอฮอล์ (Alcoholic Beverages)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-a4e33d', name: 'เหล้ามาลีบู', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'เครื่องดื่มแอลกอฮอล์ (Alcoholic Beverages)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-8a5a77', name: 'เหล้าดาครัม', brand: 'captain morgan', sizePerUnit: 'N/A', department: 'Bakery', category: 'เครื่องดื่มแอลกอฮอล์ (Alcoholic Beverages)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e0dfb9', name: 'ลิ้นจี่กระป๋อง', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'อื่นๆ (Others)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e44936', name: 'ถุงมือพลาสติก (สีดำ)', brand: 'I glove', sizePerUnit: '1 กล่อง', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 1, unit: 'กล่อง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-86b53d', name: 'ถุงพลาสติกคลุมครัวซองค์', brand: 'Lucky packing', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 5, unit: 'แพ็ค', supplier: 'Shopee', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-0d6906', name: 'ฟรอยด์ห่อเค้ก', brand: '-', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 2, minOrder: 5, unit: 'แพ็ค', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-1c8118', name: 'กระดาษห่อครัฟฟิน', brand: '-', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 5, unit: 'แพ็ค', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-6b7e94', name: 'ทิชชู่ม้วน', brand: 'Silk', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e5a492', name: 'ทิชชู่แผ่น', brand: 'aro', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-0a991f', name: 'พลาสติกแรป', brand: 'Supersave', sizePerUnit: '1 ม้วน', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'ม้วน', supplier: 'GO wholesale', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-f6c008', name: 'กระดาษไข', brand: 'aro pop-up', sizePerUnit: '1 กล่อง', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'กล่อง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-4d399f', name: 'Glade เจลหอมปรับอากาศ', brand: 'Glade', sizePerUnit: '1 กระปุก', department: 'Bakery', category: 'ผลิตภัณฑ์ทำความสะอาด (Cleaning Supplies)', minStock: 1, minOrder: 3, unit: 'กระปุก', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-8e720b', name: 'ถุงมือเตาอบ (ยาง)', brand: '-', sizePerUnit: '1 คู่', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'คู่', supplier: 'Shopee', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-97d13d', name: 'ฟองน้ำ', brand: 'สก๊อตช์-ไบรต์', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-b5b143', name: 'แก๊สกระป๋อง', brand: 'Gazu กาซู่', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-1ca250', name: 'ผ้าเขียว ส้ม', brand: 'สก๊อตช์-ไบรต์', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 3, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-4d6109', name: 'สบู่ล้างมือ', brand: 'คิเรอิ', sizePerUnit: '1 ขวด', department: 'Bakery', category: 'ผลิตภัณฑ์ทำความสะอาด (Cleaning Supplies)', minStock: 1, minOrder: 3, unit: 'ขวด', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-1602ad', name: 'ไบกอน', brand: 'ไบกอน', sizePerUnit: '1 กระป๋อง', department: 'Bakery', category: 'ผลิตภัณฑ์ทำความสะอาด (Cleaning Supplies)', minStock: 1, minOrder: 3, unit: 'กระป๋อง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-9a8f2d', name: 'ถุงขยะ 30x40 นิ้ว 1กก.', brand: 'ฮีโร่', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 3, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-bbf9bd', name: 'ผ้าถูพื้น', brand: 'สก๊อตช์-ไบรต์', sizePerUnit: '1 แพ็ค', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-e9a8d0', name: 'น้ำยาซักผ้า', brand: 'Fineline', sizePerUnit: '1 ถุง (1.25ลิตร)', department: 'Bakery', category: 'ผลิตภัณฑ์ทำความสะอาด (Cleaning Supplies)', minStock: 1, minOrder: 2, unit: 'ถุง', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-504713', name: 'น้ำยาถูพื้น', brand: 'Magic clean', sizePerUnit: '1 แกลลอน (5ลิตร)', department: 'Bakery', category: 'ผลิตภัณฑ์ทำความสะอาด (Cleaning Supplies)', minStock: 1, minOrder: 2, unit: 'แกลลอน', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-3edb07', name: 'ถุงบีบ', brand: '-', sizePerUnit: '1 แพ็ค (50ใบ)', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 3, unit: 'แพ็ค', supplier: 'นิยมหวาน', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-677ee3', name: 'ถุงคลุมซาวโดว', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 1, minOrder: 2, unit: 'แพ็ค', supplier: 'Makro', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-ef66ff', name: 'ซองกันชื้น', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-a6a7a2', name: 'น้ำยาล้างจาน', brand: 'ซันไลต์', sizePerUnit: '1 ถุง (450 กรัม)', department: 'Bakery', category: 'ผลิตภัณฑ์ทำความสะอาด (Cleaning Supplies)', minStock: 1, minOrder: 5, unit: 'ลัง', supplier: 'Shopee', image: 'https://picsum.photos/seed/bakery/200/200' },
  { id: 'b-edde83', name: 'ไม้จิ้มฟัน', brand: '-', sizePerUnit: 'N/A', department: 'Bakery', category: 'บรรจุภัณฑ์/อุปกรณ์ (Packaging & Tools)', minStock: 0, minOrder: 0, unit: 'ชิ้น', supplier: '-', image: 'https://picsum.photos/seed/bakery/200/200' },
];

export default function App() {
  const [user, setUser] = useState<{ name: string; role: UserRole; permissions?: AppPermissions } | null>(null);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stockRecord, setStockRecord] = useState<StockRecord>({});
  const [history, setHistory] = useState<StockRecord[]>([]);
  const [future, setFuture] = useState<StockRecord[]>([]);
  const [receivingRecords, setReceivingRecords] = useState<ReceivingRecord[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [checklistRecords, setChecklistRecords] = useState<any[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLogEntry[]>([]);
  const [rndReports, setRnDReports] = useState<RnDReportEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'offline'>('checking');

  const [dateRange, setDateRange] = useState({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6) });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'barStock' | 'bakeryStock' | 'bakeryPlan' | 'barReceiving' | 'bakeryReceiving' | 'barDailyCount' | 'bakeryDailyCount' | 'logs' | 'barChecklist' | 'bakeryChecklist' | 'barWaste' | 'barWasteLog' | 'bakeryWasteLog' | 'checklistHistory' | 'barPurchasing' | 'rndReport' | 'userSettings'>('home');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  

  // Permission Helpers
  const hasPermission = (funcId: keyof AppPermissions) => {
    if (!user?.permissions) {
      if (funcId === 'adminTools' && user?.role !== 'Admin') return false;
      return true;
    }
    return user.permissions[funcId] !== 'Hidden';
  };

  const isReadOnly = (funcId: keyof AppPermissions) => {
    if (!user?.permissions) return false;
    return user.permissions[funcId] === 'Review';
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (isUserMenuOpen) setIsUserMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isUserMenuOpen]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    try { localStorage.setItem('cafe-stock-record', JSON.stringify(stockRecord)); } catch (e) { console.warn('localStorage error', e); }
  }, [stockRecord]);

  useEffect(() => {
    try { localStorage.setItem('cafe-ingredients-v4', JSON.stringify(ingredients)); } catch (e) { console.warn('localStorage error', e); }
  }, [ingredients]);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.branch) return;
      const branch = user.branch;

      setDbStatus('checking');
      if (!supabase) {
        setDbStatus('offline');
        const savedIng = localStorage.getItem(`cafe-ingredients-v4-${branch}`);
        setIngredients(savedIng ? JSON.parse(savedIng) : INITIAL_INGREDIENTS);
        const savedStock = localStorage.getItem(`cafe-stock-record-${branch}`);
        setStockRecord(savedStock ? JSON.parse(savedStock) : {});
        const savedRec = localStorage.getItem(`cafe-receiving-records-${branch}`);
        setReceivingRecords(savedRec ? JSON.parse(savedRec) : []);
        const savedLogs = localStorage.getItem(`cafe-audit-logs-${branch}`);
        setLogs(savedLogs ? JSON.parse(savedLogs) : []);
        const savedChecklist = localStorage.getItem(`cafe-checklist-records-${branch}`);
        setChecklistRecords(savedChecklist ? JSON.parse(savedChecklist) : []);
        const savedWasteLogs = localStorage.getItem(`cafe-waste-logs-${branch}`);
        setWasteLogs(savedWasteLogs ? JSON.parse(savedWasteLogs) : []);
        const savedRnD = localStorage.getItem(`cafe-rnd-reports-${branch}`);
        setRnDReports(savedRnD ? JSON.parse(savedRnD) : []);
        setIsLoading(false);
        return;
      }

      try {
        const fetchAllStockRecords = async (branch: string) => {
          const allData: any[] = [];
          let page = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabase.from('stock_records')
              .select('*')
              .eq('branch', branch)
              .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) return { data: null, error };
            if (data) allData.push(...data);
            if (!data || data.length < pageSize) break;
            page++;
          }
          return { data: allData, error: null };
        };

        const [
          { data: ingredientsData, error: ingError },
          { data: stockData },
          { data: receivingData },
          { data: logsData },
          { data: checklistData },
          { data: rndData },
          { data: wasteData },
          { data: bakeryPlanDataList },
          { data: settingsData }
        ] = await Promise.all([
          supabase.from('ingredients').select('*').eq('branch', branch),
          fetchAllStockRecords(branch),
          supabase.from('receiving_records').select('*').eq('branch', branch).order('created_at', { ascending: false }).limit(200),
          supabase.from('audit_logs').select('*').eq('branch', branch).order('timestamp', { ascending: false }).limit(120),
          supabase.from('checklist_records').select('*').eq('branch', branch).order('timestamp', { ascending: false }).limit(120),
          supabase.from('rnd_reports').select('id, timestamp, date, menu_name_th, menu_name_en, product_looks, component, taste, flavor, taste_result, improvements, commenter_name, image_url, image_urls, recorder_name').eq('branch', branch).order('timestamp', { ascending: false }).limit(50),
          supabase.from('waste_logs').select('id, timestamp, date, department, ingredient_id, ingredient_name, quantity, unit, cause, solution, image_url, recorder_name').eq('branch', branch).order('timestamp', { ascending: false }).limit(100),
          supabase.from('bakery_plan_records').select('*').eq('branch', branch).order('week_key', { ascending: false }),
          supabase.from('app_settings').select('*').eq('branch', branch)
        ]);

        if (ingError) {
          console.error("Supabase Fetch Error (Ingredients):", ingError);
          setDbStatus('offline');
        } else {
          setDbStatus('connected');
        }

        if (ingredientsData && ingredientsData.length > 0) {
          setIngredients(ingredientsData.map(ing => ({
            id: ing.id,
            name: ing.name,
            brand: ing.brand,
            sizePerUnit: ing.size_per_unit,
            minStock: ing.min_stock,
            minOrder: ing.min_order,
            supplier: ing.supplier,
            unit: ing.unit,
            category: ing.category,
            image: ing.image,
            department: ing.department
          })));
        } else {
          const savedIng = localStorage.getItem(`cafe-ingredients-v4-${branch}`) || localStorage.getItem('cafe-ingredients-v4');
          const parsedIng = savedIng ? JSON.parse(savedIng) : INITIAL_INGREDIENTS;
          setIngredients(parsedIng);
          if (parsedIng.length > 0) {
            await supabase.from('ingredients').insert(parsedIng.map((ing: any) => ({ branch: branch,
              id: ing.id,
              name: ing.name,
              brand: ing.brand,
              size_per_unit: ing.sizePerUnit,
              min_stock: ing.minStock,
              min_order: ing.minOrder,
              supplier: ing.supplier,
              unit: ing.unit,
              category: ing.category,
              image: ing.image,
              department: ing.department || 'Bar'
            })));
          }
        }

        if (stockData && stockData.length > 0) {
          const newStockRecord: StockRecord = {};
          stockData.forEach(record => {
            if (!newStockRecord[record.record_date]) newStockRecord[record.record_date] = {};
            newStockRecord[record.record_date][record.ingredient_id] = {
              in: record.stock_in,
              out: record.stock_out,
              remaining: record.remaining
            };
          });
          setStockRecord(newStockRecord);
        } else {
          const savedStock = localStorage.getItem(`cafe-stock-record-${branch}`) || localStorage.getItem('cafe-stock-record');
          if (savedStock) {
            const parsedStock = JSON.parse(savedStock);
            setStockRecord(parsedStock);
            const stockInserts = [];
            for (const dateKey in parsedStock) {
              for (const ingId in parsedStock[dateKey]) {
                const val = parsedStock[dateKey][ingId];
                if (typeof val === 'number') {
                  stockInserts.push({ branch: user?.branch, record_date: dateKey, ingredient_id: ingId, remaining: val });
                } else if (val) {
                  stockInserts.push({ branch: user?.branch, 
                    record_date: dateKey, 
                    ingredient_id: ingId, 
                    stock_in: val.in ?? null, 
                    stock_out: val.out ?? null, 
                    remaining: val.remaining ?? null 
                  });
                }
              }
            }
            if (stockInserts.length > 0) await supabase.from('stock_records').insert(stockInserts);
          }
        }

        if (receivingData && receivingData.length > 0) {
          const formatted = receivingData.map(r => ({
            id: r.id,
            date: r.receive_date,
            ingredientId: r.ingredient_id,
            supplier: r.supplier,
            quantity: r.quantity,
            expiryDate: r.expiry_date,
            userName: r.user_name || '-'
          }));
          setReceivingRecords(formatted);
          try { localStorage.setItem('cafe-receiving-records', JSON.stringify(formatted)); } catch (e) { console.warn('localStorage error', e); }
        } else {
          const savedRec = localStorage.getItem(`cafe-receiving-records-${branch}`) || localStorage.getItem('cafe-receiving-records');
          if (savedRec) {
            const parsedRec = JSON.parse(savedRec);
            setReceivingRecords(parsedRec);
            if (parsedRec.length > 0) {
              // Try inserting with user_name column first
              const { error: insError } = await supabase.from('receiving_records').insert(parsedRec.map((r: any) => ({ branch: branch,
                id: r.id,
                receive_date: r.date,
                ingredient_id: r.ingredientId,
                supplier: r.supplier,
                quantity: r.quantity,
                expiry_date: r.expiryDate || null,
                user_name: r.userName || null
              })));
              
              if (insError) {
                console.warn("Bulk insert to receiving_records with user_name column failed, retrying without user_name...", insError);
                // Fallback: Retry inserting without user_name column if columns don't match
                await supabase.from('receiving_records').insert(parsedRec.map((r: any) => ({ branch: branch,
                  id: r.id,
                  receive_date: r.date,
                  ingredient_id: r.ingredientId,
                  supplier: r.supplier,
                  quantity: r.quantity,
                  expiry_date: r.expiryDate || null
                })));
              }
            }
          }
        }

        if (logsData && logsData.length > 0) {
          setLogs(logsData.map(l => ({
            id: l.id,
            timestamp: l.timestamp,
            userEmail: l.user_email,
            userRole: l.user_role,
            action: l.action,
            details: l.details
          })));
        } else {
          const savedLogs = localStorage.getItem(`cafe-audit-logs-${branch}`) || localStorage.getItem('cafe-audit-logs');
          if (savedLogs) {
            const parsedLogs = JSON.parse(savedLogs);
            setLogs(parsedLogs);
            if (parsedLogs.length > 0) {
              await supabase.from('audit_logs').insert(parsedLogs.map((l: any) => ({ branch: branch,
                id: l.id,
                timestamp: l.timestamp,
                user_email: l.userEmail,
                user_role: l.userRole,
                action: l.action,
                details: l.details
              })));
            }
          }
        }

        if (checklistData && checklistData.length > 0) {
          setChecklistRecords(checklistData.map(c => ({
            id: c.id,
            timestamp: c.timestamp,
            type: c.type,
            reportDate: c.report_date,
            reporterName: c.reporter_name,
            ...c.data
          })));
        } else {
          const savedChecklist = localStorage.getItem(`cafe-checklist-records-${branch}`) || localStorage.getItem('cafe-checklist-records');
          if (savedChecklist) {
            const parsedChecklist = JSON.parse(savedChecklist);
            setChecklistRecords(parsedChecklist);
            if (parsedChecklist.length > 0) {
              await supabase.from('checklist_records').insert(parsedChecklist.map((c: any) => {
                const { timestamp, type, reportDate, reporterName, id, ...data } = c;
                return {
                  branch,
                  id: id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
                  timestamp,
                  type,
                  report_date: reportDate,
                  reporter_name: reporterName,
                  data
                };
              }));
            }
          }
        }
        
        if (wasteData && wasteData.length > 0) {
          setWasteLogs(wasteData.map(w => ({
            id: w.id,
            timestamp: w.timestamp,
            date: w.date,
            department: w.department,
            ingredientId: w.ingredient_id,
            ingredientName: w.ingredient_name,
            quantity: w.quantity,
            unit: w.unit,
            cause: w.cause,
            solution: w.solution,
            imageUrl: w.image_url,
            recorderName: w.recorder_name
          })));
        } else {
          const savedWasteLogs = localStorage.getItem(`cafe-waste-logs-${branch}`) || localStorage.getItem('cafe-waste-logs');
          if (savedWasteLogs) {
            const parsedWaste = JSON.parse(savedWasteLogs);
            setWasteLogs(parsedWaste);
            if (parsedWaste.length > 0) {
              await supabase.from('waste_logs').insert(parsedWaste.map((w: any) => ({ branch: branch,
                id: w.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
                timestamp: w.timestamp || new Date().toISOString(),
                date: w.date,
                department: w.department,
                ingredient_id: w.ingredientId,
                ingredient_name: w.ingredientName,
                quantity: w.quantity,
                unit: w.unit,
                cause: w.cause,
                solution: w.solution,
                image_url: w.imageUrl,
                recorder_name: w.recorderName
              })));
            }
          }
        }

        if (rndData && rndData.length > 0) {
          setRnDReports(rndData.map(r => ({
            id: r.id,
            timestamp: r.timestamp,
            date: r.date,
            menuNameTH: r.menu_name_th,
            menuNameEN: r.menu_name_en,
            productLooks: r.product_looks,
            component: r.component,
            taste: JSON.parse(r.taste || '[""]'),
            flavor: JSON.parse(r.flavor || '[""]'),
            tasteResult: JSON.parse(r.taste_result || '[""]'),
            improvements: JSON.parse(r.improvements || '[""]'),
            commenterName: r.commenter_name,
            imageUrl: r.image_url,
            imageUrls: r.image_urls ? JSON.parse(r.image_urls) : [],
            recorderName: r.recorder_name
          })));
        } else {
          const savedRnD = localStorage.getItem(`cafe-rnd-reports-${branch}`) || localStorage.getItem('cafe-rnd-reports');
          if (savedRnD) {
            const parsedRnD = JSON.parse(savedRnD);
            setRnDReports(parsedRnD);
            if (parsedRnD.length > 0) {
               await supabase.from('rnd_reports').insert(parsedRnD.map((r: any) => ({ branch: branch,
                 id: r.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
                 timestamp: r.timestamp || new Date().toISOString(),
                 date: r.date,
                 menu_name_th: r.menuNameTH,
                 menu_name_en: r.menuNameEN,
                 product_looks: r.productLooks,
                 component: r.component,
                 taste: JSON.stringify(r.taste || ['']),
                 flavor: JSON.stringify(r.flavor || ['']),
                 taste_result: JSON.stringify(r.tasteResult || ['']),
                 improvements: JSON.stringify(r.improvements || ['']),
                 commenter_name: r.commenterName,
                 image_url: r.imageUrl,
                 image_urls: JSON.stringify(r.imageUrls || []),
                 recorder_name: r.recorderName
               })));
            }
          }
        }

        if (bakeryPlanDataList && bakeryPlanDataList.length > 0) {
          const formattedHistory = bakeryPlanDataList.map((h: any) => ({
            weekKey: h.week_key,
            weekLabel: h.week_label,
            savedAt: h.saved_at,
            user: h.user_name,
            data: h.plan_data
          }));
          try { localStorage.setItem('bakeryPlanHistory', JSON.stringify(formattedHistory)); } catch (e) { console.warn('localStorage error', e); }
          if (formattedHistory.length > 0) {
            try { localStorage.setItem('bakeryPlanData', JSON.stringify(formattedHistory[0].data)); } catch (e) { console.warn('localStorage error', e); } // Load latest as current
            try { localStorage.setItem('bakeryPlanLastSaved', JSON.stringify({ date: formattedHistory[0].savedAt, user: formattedHistory[0].user })); } catch (e) { console.warn('localStorage error', e); }
          }
        } else {
           const historyStr = localStorage.getItem('bakeryPlanHistory');
           if (historyStr) {
             const parsedHistory = JSON.parse(historyStr);
             if (parsedHistory.length > 0) {
               await supabase.from('bakery_plan_records').insert(parsedHistory.map((h: any) => ({ branch: branch,
                  week_key: h.weekKey,
                  week_label: h.weekLabel,
                  saved_at: h.savedAt,
                  user_name: h.user || 'Admin',
                  plan_data: h.data
               })));
             }
           }
        }

        // Sync & Load app_settings (Bakery formulas & loss settings)
        let hasLineSettings = false;
        let hasDiscordSettings = false;
        if (settingsData && settingsData.length > 0) {
          settingsData.forEach((setting: any) => {
            if (setting.setting_key === 'bakery_mixing_settings') {
              try { localStorage.setItem('bakeryMixingSettings', JSON.stringify(setting.setting_value)); } catch (e) { console.warn('localStorage error', e); }
            } else if (setting.setting_key === 'bakery_cutting_settings') {
              try { localStorage.setItem('bakeryCuttingSettings', JSON.stringify(setting.setting_value)); } catch (e) { console.warn('localStorage error', e); }
            } else if (setting.setting_key === 'bakery_item_settings') {
              try { localStorage.setItem('bakeryItemSettings', JSON.stringify(setting.setting_value)); } catch (e) { console.warn('localStorage error', e); }
            } else if (setting.setting_key === 'line_notify_settings') {
              try { localStorage.setItem('lineNotifySettings', JSON.stringify(setting.setting_value)); } catch (e) { console.warn('localStorage error', e); }
              hasLineSettings = true;
            } else if (setting.setting_key === 'discord_notify_settings') {
              try { localStorage.setItem('discordNotifySettings', JSON.stringify(setting.setting_value)); } catch (e) { console.warn('localStorage error', e); }
              hasDiscordSettings = true;
            }
          });
        }

        const savedMixing = localStorage.getItem('bakeryMixingSettings');
        const savedCutting = localStorage.getItem('bakeryCuttingSettings');
        const savedItem = localStorage.getItem('bakeryItemSettings');
        
        const settingsInserts = [];
        if (settingsData && settingsData.length > 0) {
          if (!hasLineSettings) {
             const savedLine = localStorage.getItem('lineNotifySettings');
             if (savedLine) {
               try { settingsInserts.push({ setting_key: 'line_notify_settings', setting_value: JSON.parse(savedLine) }); } catch(e) {}
             } else {
               try { localStorage.setItem('lineNotifySettings', JSON.stringify(DEFAULT_LINE_NOTIFY_SETTINGS)); } catch (e) { console.warn('localStorage error', e); }
               settingsInserts.push({ setting_key: 'line_notify_settings', setting_value: DEFAULT_LINE_NOTIFY_SETTINGS });
             }
          }
          if (!hasDiscordSettings) {
             const savedDiscord = localStorage.getItem('discordNotifySettings');
             if (savedDiscord) {
               try { settingsInserts.push({ setting_key: 'discord_notify_settings', setting_value: JSON.parse(savedDiscord) }); } catch(e) {}
             } else {
               try { localStorage.setItem('discordNotifySettings', JSON.stringify(DEFAULT_DISCORD_NOTIFY_SETTINGS)); } catch (e) { console.warn('localStorage error', e); }
               settingsInserts.push({ setting_key: 'discord_notify_settings', setting_value: DEFAULT_DISCORD_NOTIFY_SETTINGS });
             }
          }
        } else {
          // Push local settings to Supabase if Supabase settings are empty
          if (savedMixing) {
            try { settingsInserts.push({ setting_key: 'bakery_mixing_settings', setting_value: JSON.parse(savedMixing) }); } catch(e) {}
          }
          if (savedCutting) {
            try { settingsInserts.push({ setting_key: 'bakery_cutting_settings', setting_value: JSON.parse(savedCutting) }); } catch(e) {}
          }
          if (savedItem) {
            try { settingsInserts.push({ setting_key: 'bakery_item_settings', setting_value: JSON.parse(savedItem) }); } catch(e) {}
          }
          
          const savedLine = localStorage.getItem('lineNotifySettings') || JSON.stringify(DEFAULT_LINE_NOTIFY_SETTINGS);
          try { localStorage.setItem('lineNotifySettings', savedLine); } catch (e) { console.warn('localStorage error', e); }
          try { settingsInserts.push({ setting_key: 'line_notify_settings', setting_value: JSON.parse(savedLine) }); } catch(e) {}

          const savedDiscord = localStorage.getItem('discordNotifySettings') || JSON.stringify(DEFAULT_DISCORD_NOTIFY_SETTINGS);
          try { localStorage.setItem('discordNotifySettings', savedDiscord); } catch (e) { console.warn('localStorage error', e); }
          try { settingsInserts.push({ setting_key: 'discord_notify_settings', setting_value: JSON.parse(savedDiscord) }); } catch(e) {}
        }
        
        if (settingsInserts.length > 0 && supabase) {
          await supabase.from('app_settings').upsert(settingsInserts.map(s => ({ ...s, branch: user?.branch })));
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setDbStatus('offline');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.branch]);

  // Automated Backup to Supabase
  useEffect(() => {
    if (!supabase) return;

    const runBackup = async () => {
      try {
        const backupPayload = {
          bakeryPlanData: localStorage.getItem('bakeryPlanData'),
          bakeryMixingSettings: localStorage.getItem('bakeryMixingSettings'),
          bakeryCuttingSettings: localStorage.getItem('bakeryCuttingSettings'),
          ingredients: localStorage.getItem('cafe-ingredients-v4'),
          stock: localStorage.getItem('cafe-stock-record'),
          users: localStorage.getItem('cafe-app-users'),
          receiving: localStorage.getItem('cafe-receiving-records'),
          checklists: localStorage.getItem('cafe-checklist-records'),
          rnd: localStorage.getItem('cafe-rnd-reports')
        };
        
        // Attempt to insert into app_backups table
        const { error } = await supabase.from('app_backups').insert({ branch: user?.branch,
          id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
          created_at: new Date().toISOString(),
          data: backupPayload
        });
        
        if (error) {
          console.warn('Backup to app_backups failed (table might missing), falling back to audit_logs:', error.message);
          // Fallback to audit_logs if app_backups doesn't exist
          await supabase.from('audit_logs').insert({ branch: user?.branch,
            id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
            timestamp: new Date().toISOString(),
            user_email: 'system@automation',
            user_role: 'System',
            action: 'System Backup',
            details: JSON.stringify(backupPayload)
          });
        } else {
          console.log('Automated local backup to app_backups successful.');
        }
      } catch (err) {
        console.error('Automated Backup Exception:', err);
      }
    };

    // Initial backup after 1 minute
    const initialTimeout = setTimeout(runBackup, 60 * 1000);
    // Then every 60 minutes
    const interval = setInterval(runBackup, 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const addWasteLog = async (log: Omit<WasteLogEntry, 'id' | 'timestamp'>) => {
    const newLog: WasteLogEntry = {
      ...log,
      id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
      timestamp: new Date().toISOString()
    };
    
    setWasteLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 500); // keep history
      if (user?.branch) {
        try { try { localStorage.setItem(`cafe-waste-logs-${user.branch}`, JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); } } catch(e) { console.warn('localStorage full'); }
      }
      try { try { localStorage.setItem('cafe-waste-logs', JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); } } catch(e) { console.warn('localStorage full'); }
      return updated;
    });

    if (supabase) {
      await supabase.from('waste_logs').insert({ branch: user?.branch,
        id: newLog.id,
        timestamp: newLog.timestamp,
        date: newLog.date,
        department: newLog.department,
        ingredient_id: newLog.ingredientId,
        ingredient_name: newLog.ingredientName,
        quantity: newLog.quantity,
        unit: newLog.unit,
        cause: newLog.cause,
        solution: newLog.solution,
        image_url: newLog.imageUrl,
        recorder_name: newLog.recorderName
      });
    }

    addLog(`บันทึกของเสีย (${log.department})`, `บันทึกของเสีย ${log.ingredientName} จำนวน ${log.quantity} ${log.unit}`);

    // LINE Notification
    sendLineNotification(
      `\n🗑️ [รายงานของเสีย - ${newLog.department}]\n` +
      `👤 ผู้บันทึก: ${newLog.recorderName}\n` +
      `📦 วัตถุดิบ: ${newLog.ingredientName}\n` +
      `🔢 จำนวน: ${newLog.quantity} ${newLog.unit}\n` +
      `⚠️ สาเหตุ: ${newLog.cause}` +
      (newLog.solution ? `\n💡 แนวทางแก้ไข: ${newLog.solution}` : ''),
      'notifyOnWaste'
    );

    // Discord Notification
    sendDiscordNotification(
      `🗑️ **[รายงานของเสีย - ${newLog.department}]**\n` +
      `👤 ผู้บันทึก: ${newLog.recorderName}\n` +
      `📦 วัตถุดิบ: ${newLog.ingredientName}\n` +
      `🔢 จำนวน: ${newLog.quantity} ${newLog.unit}\n` +
      `⚠️ สาเหตุ: ${newLog.cause}` +
      (newLog.solution ? `\n💡 แนวทางแก้ไข: ${newLog.solution}` : ''),
      'notifyOnWaste'
    );
  };

  const updateWasteLog = async (id: string, updates: Partial<WasteLogEntry>) => {
    setWasteLogs(prev => {
      const updated = prev.map(log => log.id === id ? { ...log, ...updates } : log);
      if (user?.branch) {
        try { try { localStorage.setItem(`cafe-waste-logs-${user.branch}`, JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); } } catch(e) { console.warn('localStorage full'); }
      }
      try { try { localStorage.setItem('cafe-waste-logs', JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); } } catch(e) { console.warn('localStorage full'); }
      return updated;
    });

    if (supabase) {
      const updateData: any = {};
      if (updates.cause !== undefined) updateData.cause = updates.cause;
      if (updates.solution !== undefined) updateData.solution = updates.solution;
      
      if (Object.keys(updateData).length > 0) {
        await supabase.from('waste_logs').update(updateData).eq('id', id);
      }
    }
  };

  const addRnDReport = async (report: Omit<RnDReportEntry, 'id' | 'timestamp'>) => {
    const newReport: RnDReportEntry = {
      ...report,
      id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
      timestamp: new Date().toISOString()
    };
    
    setRnDReports(prev => {
      const updated = [newReport, ...prev].slice(0, 500);
      if (user?.branch) {
        try { try { localStorage.setItem(`cafe-rnd-reports-${user.branch}`, JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); } } catch(e) { console.warn('localStorage full'); }
      }
      try { try { localStorage.setItem('cafe-rnd-reports', JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); } } catch(e) { console.warn('localStorage full'); }
      return updated;
    });

    if (supabase) {
      await supabase.from('rnd_reports').insert({ branch: user?.branch,
        id: newReport.id,
        timestamp: newReport.timestamp,
        date: newReport.date,
        menu_name_th: newReport.menuNameTH,
        menu_name_en: newReport.menuNameEN,
        product_looks: newReport.productLooks,
        component: newReport.component,
        taste: JSON.stringify(newReport.taste),
        flavor: JSON.stringify(newReport.flavor),
        taste_result: JSON.stringify(newReport.tasteResult),
        improvements: JSON.stringify(newReport.improvements),
        commenter_name: newReport.commenterName,
        image_url: newReport.imageUrl,
        image_urls: JSON.stringify(newReport.imageUrls || []),
        recorder_name: newReport.recorderName
      });
    }

    addLog(`บันทึก R&D Report`, `เพิ่มเมนูใหม่: ${report.menuNameTH} / ${report.menuNameEN}`);

    // LINE Notification
    const resultString = Array.isArray(newReport.tasteResult) 
      ? newReport.tasteResult.join(', ') 
      : newReport.tasteResult;
    sendLineNotification(
      `\n🧪 [พัฒนาเมนูใหม่ R&D - ${newReport.menuNameTH}]\n` +
      `👤 ผู้บันทึก: ${newReport.recorderName}\n` +
      `🏷️ เมนูหลัก: ${newReport.menuNameTH} (${newReport.menuNameEN})\n` +
      `📝 ส่วนผสม: ${newReport.component || '-'}\n` +
      `👅 ผลประเมินรสชาติ: ${resultString || '-'}`,
      'notifyOnRnD'
    );

    // Discord Notification
    sendDiscordNotification(
      `🧪 **[พัฒนาเมนูใหม่ R&D - ${newReport.menuNameTH}]**\n` +
      `👤 ผู้บันทึก: ${newReport.recorderName}\n` +
      `🏷️ เมนูหลัก: ${newReport.menuNameTH} (${newReport.menuNameEN})\n` +
      `📝 ส่วนผสม: ${newReport.component || '-'}\n` +
      `👅 ผลประเมินรสชาติ: ${resultString || '-'}`,
      'notifyOnRnD'
    );
  };

  const updateRnDReport = async (id: string, updatedData: Omit<RnDReportEntry, 'id' | 'timestamp'>) => {
    setRnDReports(prev => {
      const updated = prev.map(report => report.id === id ? { ...report, ...updatedData } : report);
      if (user?.branch) {
        try { try { localStorage.setItem(`cafe-rnd-reports-${user.branch}`, JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); } } catch(e) { console.warn('localStorage full'); }
      }
      try { try { localStorage.setItem('cafe-rnd-reports', JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); } } catch(e) { console.warn('localStorage full'); }
      return updated;
    });

    if (supabase) {
      await supabase.from('rnd_reports').update({
        date: updatedData.date,
        menu_name_th: updatedData.menuNameTH,
        menu_name_en: updatedData.menuNameEN,
        product_looks: updatedData.productLooks,
        component: updatedData.component,
        taste: JSON.stringify(updatedData.taste),
        flavor: JSON.stringify(updatedData.flavor),
        taste_result: JSON.stringify(updatedData.tasteResult),
        improvements: JSON.stringify(updatedData.improvements),
        commenter_name: updatedData.commenterName,
        image_url: updatedData.imageUrl,
        image_urls: JSON.stringify(updatedData.imageUrls || []),
        recorder_name: updatedData.recorderName
      }).eq('id', id);
    }

    addLog(`แก้ไข R&D Report`, `อัปเดตเมนู: ${updatedData.menuNameTH} / ${updatedData.menuNameEN}`);

    // LINE Notification
    const resultString = Array.isArray(updatedData.tasteResult) 
      ? updatedData.tasteResult.join(', ') 
      : updatedData.tasteResult;
    sendLineNotification(
      `\n📝 [อัปเดตสูตร R&D - ${updatedData.menuNameTH}]\n` +
      `👤 ผู้ปรับปรุง: ${updatedData.recorderName}\n` +
      `🏷️ เมนูหลัก: ${updatedData.menuNameTH} (${updatedData.menuNameEN})\n` +
      `👅 ผลประเมินล่าสุด: ${resultString || '-'}`,
      'notifyOnRnD'
    );

    // Discord Notification
    sendDiscordNotification(
      `📝 **[อัปเดตสูตร R&D - ${updatedData.menuNameTH}]**\n` +
      `👤 ผู้ปรับปรุง: ${updatedData.recorderName}\n` +
      `🏷️ เมนูหลัก: ${updatedData.menuNameTH} (${updatedData.menuNameEN})\n` +
      `👅 ผลประเมินล่าสุด: ${resultString || '-'}`,
      'notifyOnRnD'
    );
  };

  const resetData = () => {
    if (confirm('This will reset all ingredients to the default list. Your stock counts will be preserved where possible. Continue?')) {
      setIngredients(INITIAL_INGREDIENTS);
      if (supabase) {
        // Optional: Reset Supabase ingredients as well
      }
    }
  };

  const addLog = async (action: string, details: string) => {
    if (!user) return;
    const newLog: LogEntry = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
      timestamp: new Date().toISOString(),
      userEmail: user.name,
      userRole: user.role,
      action,
      details
    };
    setLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 120);
      if (user?.branch) {
        try { localStorage.setItem(`cafe-audit-logs-${user.branch}`, JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); }
      }
      try { localStorage.setItem('cafe-audit-logs', JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); }
      return updated;
    });
    
    if (supabase) {
      await supabase.from('audit_logs').insert({ branch: user?.branch,
        id: newLog.id,
        timestamp: newLog.timestamp,
        user_email: newLog.userEmail,
        user_role: newLog.userRole,
        action: newLog.action,
        details: newLog.details
      });
    }
  };

  const handleAddReceivingRecord = async (record: Omit<ReceivingRecord, 'id'>) => {
    const newRecord = { ...record, id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)), userName: user?.name || '-' };
    setReceivingRecords(prev => {
      const updated = [...prev, newRecord];
      if (user?.branch) {
        try { localStorage.setItem(`cafe-receiving-records-${user.branch}`, JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); }
      }
      try { localStorage.setItem('cafe-receiving-records', JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); }
      return updated;
    });
    
    if (supabase) {
      const { error } = await supabase.from('receiving_records').insert({ branch: user?.branch,
        id: newRecord.id,
        receive_date: newRecord.date,
        ingredient_id: newRecord.ingredientId,
        supplier: newRecord.supplier,
        quantity: newRecord.quantity,
        expiry_date: newRecord.expiryDate || null,
        user_name: newRecord.userName
      });

      if (error) {
        console.warn("Inserting receiving record with user_name column failed, retrying without user_name...", error);
        // Fallback: Retry inserting without user_name column
        const { error: retryError } = await supabase.from('receiving_records').insert({ branch: user?.branch,
          id: newRecord.id,
          receive_date: newRecord.date,
          ingredient_id: newRecord.ingredientId,
          supplier: newRecord.supplier,
          quantity: newRecord.quantity,
          expiry_date: newRecord.expiryDate || null
        });
        if (retryError) {
          console.error("Inserting receiving record completely failed:", retryError);
        }
      }
    }
    
    const ingredient = ingredients.find(i => i.id === record.ingredientId);
    addLog('บันทึกการรับวัตถุดิบ', `รับ ${ingredient?.name || 'ไม่ทราบชื่อ'} จำนวน ${record.quantity} ${ingredient?.unit || ''} (วันที่ ${record.date})`);

    // Update stock record "in" field
    setStockRecord(prev => {
      const dateKey = record.date;
      const dayRecord = prev[dateKey] || {};
      const currentVal = dayRecord[record.ingredientId];
      
      let currentObj = { in: undefined as number | undefined, out: undefined as number | undefined, remaining: undefined as number | undefined };
      if (typeof currentVal === 'number') {
        currentObj = { in: undefined, out: undefined, remaining: currentVal };
      } else if (currentVal) {
        currentObj = { ...currentVal };
      }

      currentObj.in = (currentObj.in || 0) + record.quantity;
      if (currentObj.remaining !== undefined) {
        currentObj.remaining += record.quantity;
      }

      if (supabase) {
        supabase.from('stock_records').upsert({ branch: user?.branch || 'Rayong',
          record_date: dateKey,
          ingredient_id: record.ingredientId,
          stock_in: currentObj.in,
          stock_out: currentObj.out ?? null,
          remaining: currentObj.remaining ?? null
        }, { onConflict: 'record_date,ingredient_id,branch' }).then();
      }

      return {
        ...prev,
        [dateKey]: {
          ...dayRecord,
          [record.ingredientId]: currentObj
        }
      };
    });

    alert('บันทึกการรับวัตถุดิบเรียบร้อยแล้ว ข้อมูลถูกอัปเดตในตารางหลัก');
    setActiveTab('home');

    // LINE Notification
    const ingName = ingredient?.name || 'ไม่ทราบชื่อ';
    sendLineNotification(
      `\n📥 [รับวัตถุดิบนำเข้า - ${ingredient?.department || 'บาร์'}]\n` +
      `👤 ผู้รับ: ${newRecord.userName}\n` +
      `📦 วัตถุดิบ: ${ingName}\n` +
      `🔢 จำนวน: ${record.quantity} ${ingredient?.unit || ''}\n` +
      `🏢 ผู้จัดจำหน่าย: ${record.supplier || '-'}` +
      (record.expiryDate ? `\n⏳ วันหมดอายุ: ${record.expiryDate}` : ''),
      'notifyOnReceiving'
    );

    // Discord Notification
    sendDiscordNotification(
      `📥 **[รับวัตถุดิบนำเข้า - ${ingredient?.department || 'บาร์'}]**\n` +
      `👤 ผู้รับ: ${newRecord.userName}\n` +
      `📦 วัตถุดิบ: ${ingName}\n` +
      `🔢 จำนวน: ${record.quantity} ${ingredient?.unit || ''}\n` +
      `🏢 ผู้จัดจำหน่าย: ${record.supplier || '-'}` +
      (record.expiryDate ? `\n⏳ วันหมดอายุ: ${record.expiryDate}` : ''),
      'notifyOnReceiving'
    );
  };

  const handleDeleteReceivingRecord = async (id: string) => {
    const record = receivingRecords.find(r => r.id === id);
    const ingredient = ingredients.find(i => i.id === record?.ingredientId);
    if (!record) return;

    addLog('ลบรายการรับวัตถุดิบ', `ลบรายการรับ ${ingredient?.name || 'ไม่ทราบชื่อ'} จำนวน ${record?.quantity || 0} ${ingredient?.unit || ''} (วันที่ ${record?.date || '-'})`);
    setReceivingRecords(prev => {
      const updated = prev.filter(r => r.id !== id);
      if (user?.branch) {
        try { localStorage.setItem(`cafe-receiving-records-${user.branch}`, JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); }
      }
      try { localStorage.setItem('cafe-receiving-records', JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); }
      return updated;
    });
    
    // Reverse stock record "in" field
    setStockRecord(prev => {
      const dateKey = record.date;
      const dayRecord = prev[dateKey] || {};
      const currentVal = dayRecord[record.ingredientId];
      if (!currentVal) return prev;

      let currentObj = { in: undefined as number | undefined, out: undefined as number | undefined, remaining: undefined as number | undefined };
      if (typeof currentVal === 'number') {
        currentObj = { in: undefined, out: undefined, remaining: currentVal };
      } else if (currentVal) {
        currentObj = { ...currentVal };
      }

      // Reverse the quantity
      if (currentObj.in !== undefined) {
        currentObj.in = Math.max(0, currentObj.in - record.quantity);
        if (currentObj.in === 0) currentObj.in = undefined;
      }
      if (currentObj.remaining !== undefined) {
        currentObj.remaining = Math.max(0, currentObj.remaining - record.quantity);
        if (currentObj.remaining === 0 && currentObj.in === undefined && currentObj.out === undefined) {
          currentObj.remaining = undefined;
        }
      }

      if (supabase) {
        if (currentObj.in === undefined && currentObj.out === undefined && currentObj.remaining === undefined) {
           supabase.from('stock_records').delete().match({ record_date: dateKey, ingredient_id: record.ingredientId }).then();
        } else {
           supabase.from('stock_records').upsert({ branch: user?.branch || 'Rayong',
            record_date: dateKey,
            ingredient_id: record.ingredientId,
            stock_in: currentObj.in ?? null,
            stock_out: currentObj.out ?? null,
            remaining: currentObj.remaining ?? null
        }, { onConflict: 'record_date,ingredient_id,branch' }).then();
        }
      }

      if (currentObj.in === undefined && currentObj.out === undefined && currentObj.remaining === undefined) {
        const { [record.ingredientId]: _, ...rest } = dayRecord;
        if (Object.keys(rest).length === 0) {
          const { [dateKey]: __, ...restDays } = prev;
          return restDays;
        }
        return {
          ...prev,
          [dateKey]: rest
        };
      }

      return {
        ...prev,
        [dateKey]: {
          ...dayRecord,
          [record.ingredientId]: currentObj
        }
      };
    });

    if (supabase) {
      await supabase.from('receiving_records').delete().eq('id', id);
    }
  };

  const handleAddIngredient = async (ingredient: Ingredient) => {
    setIngredients(prev => [...prev, ingredient]);
    addLog('เพิ่มวัตถุดิบใหม่', `เพิ่ม ${ingredient.name} (${ingredient.category})`);
    setIsFormOpen(false);
    
    if (supabase) {
      await supabase.from('ingredients').insert({ branch: user?.branch,
        id: ingredient.id,
        name: ingredient.name,
        brand: ingredient.brand,
        size_per_unit: ingredient.sizePerUnit,
        min_stock: ingredient.minStock,
        min_order: ingredient.minOrder,
        supplier: ingredient.supplier,
        unit: ingredient.unit,
        category: ingredient.category,
        image: ingredient.image,
        department: ingredient.department
      });
    }
  };

  const handleEditIngredient = async (updatedIngredient: Ingredient) => {
    setIngredients(prev => prev.map(ing => ing.id === updatedIngredient.id ? updatedIngredient : ing));
    addLog('แก้ไขข้อมูลวัตถุดิบ', `แก้ไขข้อมูล ${updatedIngredient.name}`);
    setEditingIngredient(null);
    
    if (supabase) {
      await supabase.from('ingredients').update({
        name: updatedIngredient.name,
        brand: updatedIngredient.brand,
        size_per_unit: updatedIngredient.sizePerUnit,
        min_stock: updatedIngredient.minStock,
        min_order: updatedIngredient.minOrder,
        supplier: updatedIngredient.supplier,
        unit: updatedIngredient.unit,
        category: updatedIngredient.category,
        image: updatedIngredient.image,
        department: updatedIngredient.department
      }).eq('id', updatedIngredient.id);
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    const ingredient = ingredients.find(i => i.id === id);
    addLog('ลบวัตถุดิบ', `ลบ ${ingredient?.name || 'ไม่ทราบชื่อ'}`);
    setIngredients(prev => prev.filter(i => i.id !== id));
    
    if (supabase) {
      await supabase.from('ingredients').delete().eq('id', id);
    }
  };

  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isExportDropdownOpen) {
        setIsExportDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isExportDropdownOpen]);

  const handleImportExcel = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`เลือกไฟล์ ${file.name} แล้ว (ฟังก์ชันการนำเข้าข้อมูลกำลังอยู่ในระหว่างการพัฒนา)`);
      // Reset input
      e.target.value = '';
    }
  };

  const handleUpdateStock = async (ingredientId: string, date: Date, field: 'in' | 'out' | 'remaining', value: number | undefined) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const ingredient = ingredients.find(i => i.id === ingredientId);
    const fieldLabel = field === 'in' ? 'เข้า' : field === 'out' ? 'เบิก' : 'คงเหลือ';
    addLog('แก้ไขสต็อกรายช่อง', `แก้ไข ${ingredient?.name || 'ไม่ทราบชื่อ'} ช่อง ${fieldLabel} เป็น ${value ?? 'ว่าง'} (วันที่ ${dateKey})`);
    
    // Save current state to history before updating
    setHistory(prev => [...prev, stockRecord].slice(-20));
    setFuture([]); // Clear future on new action

    setStockRecord(prev => {
      const dayRecord = prev[dateKey] || {};
      const currentVal = dayRecord[ingredientId];
      
      let currentObj = { in: undefined as number | undefined, out: undefined as number | undefined, remaining: undefined as number | undefined };
      if (typeof currentVal === 'number') {
        currentObj = { in: undefined, out: undefined, remaining: currentVal };
      } else if (currentVal) {
        currentObj = { ...currentVal };
      }

      currentObj[field] = value;

      // ล้างยอดนับเอง (remaining) อัตโนมัติ หากผู้ใช้อัพเดท in หรือ out เพื่อให้ระบบคำนวณใหม่
      if (field === 'in' || field === 'out') {
        currentObj.remaining = undefined;
      }

      if (supabase) {
        if (currentObj.in === undefined && currentObj.out === undefined && currentObj.remaining === undefined) {
          supabase.from('stock_records').delete().match({ record_date: dateKey, ingredient_id: ingredientId }).then();
        } else {
          supabase.from('stock_records').upsert({ branch: user?.branch || 'Rayong',
            record_date: dateKey,
            ingredient_id: ingredientId,
            stock_in: currentObj.in ?? null,
            stock_out: currentObj.out ?? null,
            remaining: currentObj.remaining ?? null
        }, { onConflict: 'record_date,ingredient_id,branch' }).then();
        }
      }

      // If all fields are undefined, remove the entry
      if (currentObj.in === undefined && currentObj.out === undefined && currentObj.remaining === undefined) {
        const { [ingredientId]: _, ...rest } = dayRecord;
        if (Object.keys(rest).length === 0) {
          const { [dateKey]: __, ...restDays } = prev;
          return restDays;
        }
        return { ...prev, [dateKey]: rest };
      }

      return {
        ...prev,
        [dateKey]: {
          ...dayRecord,
          [ingredientId]: currentObj
        }
      };
    });
  };

  const handleClearDay = async (dateKey: string) => {
    const dept = activeTab === 'barStock' ? 'Bar' : 'Bakery';
    const deptIngredients = ingredients.filter(item => item.department === dept);
    const targetIds = deptIngredients.map(ing => ing.id);

    addLog('ล้างข้อมูลรายวัน', `ล้างข้อมูลสต็อกทั้งหมดของวันที่ ${dateKey} (${dept})`);

    setHistory(prev => [...prev, stockRecord].slice(-20));
    setFuture([]);

    setStockRecord(prev => {
      const newRecord = { ...prev };
      if (newRecord[dateKey]) {
        const dayRecord = { ...newRecord[dateKey] };
        targetIds.forEach(id => {
          delete dayRecord[id];
        });
        if (Object.keys(dayRecord).length === 0) {
          delete newRecord[dateKey];
        } else {
          newRecord[dateKey] = dayRecord;
        }
      }
      return newRecord;
    });
    
    if (supabase) {
      await supabase.from('stock_records').delete().eq('record_date', dateKey).in('ingredient_id', targetIds);
    }
  };

  const handleClearIngredientWeek = async (ingredientId: string) => {
    const daysCount = Math.max(1, Math.min(7, differenceInDays(dateRange.end, dateRange.start) + 1));
    const weekDays = Array.from({ length: daysCount }).map((_, i) => format(addDays(dateRange.start, i), 'yyyy-MM-dd'));
    const ingredient = ingredients.find(i => i.id === ingredientId);

    addLog('ล้างข้อมูลวัตถุดิบรายสัปดาห์', `ล้างข้อมูล ${ingredient?.name || 'ไม่ทราบชื่อ'} ทั้งสัปดาห์`);

    setHistory(prev => [...prev, stockRecord].slice(-20));
    setFuture([]);

    setStockRecord(prev => {
      const newRecord = { ...prev };
      weekDays.forEach(dateKey => {
        if (newRecord[dateKey] && newRecord[dateKey][ingredientId]) {
          const dayRecord = { ...newRecord[dateKey] };
          delete dayRecord[ingredientId];
          if (Object.keys(dayRecord).length === 0) {
            delete newRecord[dateKey];
          } else {
            newRecord[dateKey] = dayRecord;
          }
        }
      });
      return newRecord;
    });
    
    if (supabase) {
      await supabase.from('stock_records').delete().eq('ingredient_id', ingredientId).in('record_date', weekDays);
    }
  };

  const handleSubmitDailyCount = async (dateKey: string, counts: Record<string, number>, department?: string) => {
    const changes: Array<{ ingredientId: string, ingredientName: string, oldVal: number | string, newVal: number, unit: string }> = [];
    
    Object.entries(counts).forEach(([ingredientId, count]) => {
      const currentVal = stockRecord[dateKey]?.[ingredientId];
      let currentRemaining: number | string = '-';
      if (typeof currentVal === 'number') {
        currentRemaining = currentVal;
      } else if (currentVal && typeof currentVal.remaining === 'number') {
        currentRemaining = currentVal.remaining;
      }
      
      if (currentRemaining !== count) {
        const ingredient = ingredients.find(ing => ing.id === ingredientId);
        if (ingredient) {
          changes.push({
            ingredientId,
            ingredientName: ingredient.name,
            oldVal: currentRemaining,
            newVal: count,
            unit: ingredient.unit
          });
        }
      }
    });

    const detailsStr = JSON.stringify({
      summary: `ส่งรายงานตรวจนับประจำวันที่ ${dateKey} (เปลี่ยนแปลง ${changes.length} รายการ)`,
      changes: changes
    });

    addLog(`ส่งรายงานตรวจนับสต็อก${department ? ` (${department})` : ''}`, detailsStr);
    setHistory(prev => [...prev, stockRecord].slice(-20));
    setFuture([]);

    setStockRecord(prev => {
      const newRecord = { ...prev };
      const dayRecord = { ...(newRecord[dateKey] || {}) };
      
      Object.entries(counts).forEach(([ingredientId, count]) => {
        const currentVal = dayRecord[ingredientId];
        let currentObj: { in?: number; out?: number; remaining?: number } = {};
        
        if (typeof currentVal === 'number') {
          currentObj = { remaining: currentVal };
        } else if (currentVal) {
          currentObj = { ...currentVal };
        }
        
        currentObj.remaining = count;
        dayRecord[ingredientId] = currentObj;
      });
      
      newRecord[dateKey] = dayRecord;
      return newRecord;
    });
    
    if (supabase) {
      const upserts = Object.entries(counts).map(([ingredientId, count]) => {
        const currentVal = stockRecord[dateKey]?.[ingredientId];
        let currentIn = 0;
        let currentOut = 0;
        if (typeof currentVal !== 'number' && currentVal) {
          currentIn = currentVal.in || 0;
          currentOut = currentVal.out || 0;
        }
        return { branch: user?.branch,
          record_date: dateKey,
          ingredient_id: ingredientId,
          stock_in: currentIn,
          stock_out: currentOut,
          remaining: count
        };
      });
      
      if (upserts.length > 0) {
        const { error } = await supabase.from('stock_records').upsert(
          upserts.map(u => ({ ...u, branch: user?.branch || 'Rayong' })), 
          { onConflict: 'record_date,ingredient_id,branch' }
        );
        if (error) {
          console.error("Upsert error:", error);
          alert(`เกิดข้อผิดพลาดในการบันทึก: ${error.message}`);
          return;
        }
      }
    }
    
    alert('ส่งรายงานเรียบร้อยแล้ว ข้อมูลถูกอัปเดตในตารางหลัก');
    setActiveTab('home');

    // LINE Notification
    let notificationMsg = `\n📦 [รายงานตรวจนับสต็อก - สรุปประจำวัน ${department || ''}]\n` +
                          `👤 ผู้บันทึก: ${user?.name || 'Unknown'}\n` +
                          `📅 วันที่บันทึกสต็อก: ${dateKey}\n` +
                          `📝 การเปลี่ยนแปลง: ${changes.length} รายการ\n`;
    
    let discordMsg = `📦 **[รายงานตรวจนับสต็อก - สรุปประจำวัน ${department || ''}]**\n` +
                     `👤 ผู้บันทึก: ${user?.name || 'Unknown'}\n` +
                     `📅 วันที่บันทึกสต็อก: ${dateKey}\n` +
                     `📝 การเปลี่ยนแปลง: ${changes.length} รายการ\n`;

    if (changes.length > 0) {
      notificationMsg += `\n🔍 รายการหลักที่เปลี่ยนแปลง:\n`;
      discordMsg += `\n🔍 รายการหลักที่เปลี่ยนแปลง:\n`;
      changes.slice(0, 10).forEach((item) => {
        notificationMsg += `- ${item.ingredientName}: ${item.oldVal === '-' ? '-' : `${item.oldVal} `}➔ ${item.newVal} ${item.unit}\n`;
        discordMsg += `- ${item.ingredientName}: ${item.oldVal === '-' ? '-' : `${item.oldVal} `}➔ ${item.newVal} ${item.unit}\n`;
      });
      if (changes.length > 10) {
        notificationMsg += `...และอีก ${changes.length - 10} รายการ`;
        discordMsg += `...และอีก ${changes.length - 10} รายการ`;
      }
    } else {
      notificationMsg += `ไม่มีรายการใดเปลี่ยนแปลง (ยอดคงเหลือตรงกับระบบ)`;
      discordMsg += `ไม่มีรายการใดเปลี่ยนแปลง (ยอดคงเหลือตรงกับระบบ)`;
    }

    sendLineNotification(notificationMsg, 'notifyOnStockSubmit');
    sendDiscordNotification(discordMsg, 'notifyOnStockSubmit');
  };

  const handleSaveChecklist = async (type: 'Check-in' | 'Check-out', data: any) => {
    const newRecord = { ...data, type, userEmail: user?.name, id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)) };
    setChecklistRecords(prev => {
      const updated = [newRecord, ...prev].slice(0, 120);
      if (user?.branch) {
        try { localStorage.setItem(`cafe-checklist-records-${user.branch}`, JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); }
      }
      try { localStorage.setItem('cafe-checklist-records', JSON.stringify(updated)); } catch (e) { console.warn('localStorage error', e); }
      return updated;
    });
    addLog(`${type} สำหรับบาร์`, `บันทึกรายการตรวจสอบ ${type} เรียบร้อยแล้ว เมื่อ ${format(new Date(), 'HH:mm')}`);
    
    if (supabase) {
      const { timestamp, type: recordType, reportDate, reporterName, id, userEmail, ...recordData } = newRecord;
      await supabase.from('checklist_records').insert({ branch: user?.branch,
        id,
        timestamp,
        type: recordType,
        report_date: reportDate,
        reporter_name: reporterName,
        data: recordData
      });
    }
    
    alert(`บันทึก ${type} เรียบร้อยแล้ว`);
    setActiveTab('home');

    // LINE Notification
    const dept = (data.coffeeWeights || data.coffeeDialIn) ? 'บาร์ (Bar)' : 'เบเกอรี่ (Bakery)';
    sendLineNotification(
      `\n📋 [รายงานเช็คลิสต์ - ${dept}]\n` +
      `👤 ผู้บันทึก: ${data.reporterName || '-'}\n` +
      `📅 วันที่รายงาน: ${data.reportDate}\n` +
      `⚙️ ประเภทงาน: ${type}`,
      'notifyOnChecklist'
    );

    // Discord Notification
    sendDiscordNotification(
      `📋 **[รายงานเช็คลิสต์ - ${dept}]**\n` +
      `👤 ผู้บันทึก: ${data.reporterName || '-'}\n` +
      `📅 วันที่รายงาน: ${data.reportDate}\n` +
      `⚙️ ประเภทงาน: ${type}`,
      'notifyOnChecklist'
    );
  };

  const syncStockRecordToSupabase = async (newStockRecord: StockRecord) => {
    if (!supabase) return;
    
    const stockInserts: any[] = [];
    for (const dateKey in newStockRecord) {
      for (const ingId in newStockRecord[dateKey]) {
        const val = newStockRecord[dateKey][ingId];
        if (typeof val === 'number') {
          stockInserts.push({ branch: user?.branch, record_date: dateKey, ingredient_id: ingId, remaining: val });
        } else if (val) {
          stockInserts.push({ branch: user?.branch, 
            record_date: dateKey, 
            ingredient_id: ingId, 
            stock_in: val.in ?? null, 
            stock_out: val.out ?? null, 
            remaining: val.remaining ?? null 
          });
        }
      }
    }
    
    // Delete all existing records and insert new ones
    await supabase.from('stock_records').delete().neq('ingredient_id', '00000000-0000-0000-0000-000000000000');
    if (stockInserts.length > 0) {
      await supabase.from('stock_records').insert(stockInserts);
    }
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setFuture(prev => [stockRecord, ...prev].slice(0, 20));
    setHistory(newHistory);
    setStockRecord(previous);
    
    await syncStockRecordToSupabase(previous);
  };

  const handleRedo = async () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory(prev => [...prev, stockRecord].slice(-20));
    setFuture(newFuture);
    setStockRecord(next);
    
    await syncStockRecordToSupabase(next);
  };



  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const daysCount = Math.max(1, Math.min(7, differenceInDays(dateRange.end, dateRange.start) + 1));
    const weekDays = Array.from({ length: daysCount }).map((_, i) => addDays(dateRange.start, i));
    
    const dept = activeTab === 'barStock' ? 'Bar' : 'Bakery';
    const deptIngredients = ingredients.filter(item => item.department === dept);

    const data = deptIngredients.map(item => {
      const row: any = {
        'หมวดหมู่': item.category,
        'รายการสินค้า': item.name,
        'ยี่ห้อ': item.brand,
        'ขนาด/หน่วย': item.sizePerUnit,
        'จำนวนคงเหลือขั้นต่ำ': item.minStock,
        'จำนวนสั่งซื้อขั้นต่ำ': item.minOrder,
        'ผู้จัดจำหน่าย': item.supplier,
      };

      weekDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const val = stockRecord[dateKey]?.[item.id];
        let currentStockObj = { in: undefined as number | undefined, out: undefined as number | undefined, remaining: undefined as number | undefined };
        if (typeof val === 'number') {
          currentStockObj = { in: undefined, out: undefined, remaining: val };
        } else if (val) {
          currentStockObj = { ...val };
        }
        
        row[`${format(day, 'EEE d/M')} เข้า`] = currentStockObj.in !== undefined ? currentStockObj.in : '-';
        row[`${format(day, 'EEE d/M')} เบิก`] = currentStockObj.out !== undefined ? currentStockObj.out : '-';
        row[`${format(day, 'EEE d/M')} คงเหลือ`] = currentStockObj.remaining !== undefined ? currentStockObj.remaining : '-';
      });

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
    XLSX.writeFile(wb, `${dept}_Stock_Report_${format(dateRange.start, 'yyyy-MM-dd')}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const stockSummary = useMemo(() => {
    let lowStock = 0;
    let outOfStock = 0;
    
    const dates = Object.keys(stockRecord).sort();
    
    const canViewBar = hasPermission('dashboardBar');
    const canViewBakery = hasPermission('dashboardBakery');

    const filteredIngredients = ingredients.filter(ing => {
      if (ing.department === 'Bar' && !canViewBar) return false;
      if (ing.department === 'Bakery' && !canViewBakery) return false;
      return true;
    });
    
    const currentRemaining: Record<string, number> = {};

    dates.forEach(dateKey => {
      filteredIngredients.forEach(ing => {
        const id = ing.id;
        const val = stockRecord[dateKey]?.[id];
        
        if (typeof val === 'number') {
          currentRemaining[id] = val;
        } else if (val) {
          const inVal = val.in === null ? undefined : val.in;
          const outVal = val.out === null ? undefined : val.out;
          const explicitRemaining = val.remaining === null ? undefined : val.remaining;

          if (explicitRemaining !== undefined) {
             currentRemaining[id] = explicitRemaining;
          } else {
             if (currentRemaining[id] !== undefined || inVal !== undefined || outVal !== undefined) {
               const prevRemaining = currentRemaining[id] || 0;
               const added = inVal || 0;
               const removed = outVal || 0;
               currentRemaining[id] = prevRemaining + added - removed;
             }
          }
        }
      });
    });

    filteredIngredients.forEach(ing => {
      const latestRemaining = currentRemaining[ing.id];
      if (latestRemaining === undefined || latestRemaining <= 0) {
        outOfStock++;
      } else if (latestRemaining <= ing.minStock) {
        lowStock++;
      }
    });
    
    return { lowStock, outOfStock };
  }, [ingredients, stockRecord]);

  if (!user) {
    return <LoginForm onLogin={(userData) => setUser(userData)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Print Header */}
      <div className="print-header">
        <h1>Cafe Stock Manager - Weekly Report</h1>
        <p>Date: {format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')}</p>
      </div>

      {/* Header */}
      <header className="bg-slate-800 text-white shadow-lg sticky top-0 z-[60] border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-18 flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Logo className="rounded-[4px] shadow-sm py-1.5 px-3" textClassName="text-xl" showSubtitle={false} />
            <div className="flex items-center gap-4">
              <h1 className="font-bold tracking-tight leading-tight text-slate-100 text-[16px] hidden sm:block">Cafe Stock Manager</h1>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/50 border border-slate-700/50">
                <div className={`w-2 h-2 rounded-full ${
                  dbStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' :
                  dbStatus === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
                }`}></div>
                <span className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">
                  {dbStatus === 'connected' ? 'Supabase Connected' : 
                   dbStatus === 'checking' ? 'Connecting...' : 'Local Offline Mode'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-slate-300 text-[14px] font-medium hidden sm:block">
              {format(new Date(), 'dd MMM yyyy')}
            </div>
            <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-medium text-slate-200">{user.name}</span>
              <span className="px-2 py-0.5 rounded-md text-[12px] bg-slate-700 text-blue-200 uppercase tracking-wider font-semibold border border-slate-600">
                {user.role}
              </span>
            </div>
            <div className="relative z-50">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all ml-1"
                title="Settings"
              >
                <Settings size={20} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {hasPermission('adminTools') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab('userSettings');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[14px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors font-medium border-b border-slate-100"
                    >
                      User Security Settings
                      <Settings size={14} className="text-slate-400" />
                    </button>
                  )}
                  <button
                    onClick={() => setUser(null)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-[14px] text-red-600 hover:bg-red-50 transition-colors font-medium"
                  >
                    Log-out
                    <LogOut size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {activeTab !== 'home' && (
          <div className="mb-6">
            <button 
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl text-[14px] font-bold transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
              ย้อนกลับหน้าหลัก
            </button>
          </div>
        )}

        {activeTab === 'home' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* Dashboard Summary Card */}
            {(hasPermission('dashboardBar') || hasPermission('dashboardBakery')) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <LayoutDashboard className="text-blue-600" size={24} />
                    ภาพรวมสต็อก (Dashboard)
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">สรุปสถานะสินค้าคงคลังปัจจุบัน</p>
                </div>
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  ดูรายละเอียดทั้งหมด
                  <ChevronRight size={16} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-red-100 p-3 rounded-full text-red-600">
                    <PackageCheck size={24} />
                  </div>
                  <div>
                    <p className="text-red-600 text-sm font-bold mb-1">สินค้าหมดสต็อก</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-red-700">{stockSummary.outOfStock}</span>
                      <span className="text-red-500 text-sm font-medium">รายการ</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                    <ClipboardCheck size={24} />
                  </div>
                  <div>
                    <p className="text-orange-600 text-sm font-bold mb-1">สินค้าใกล้หมด (ต่ำกว่าขั้นต่ำ)</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-orange-700">{stockSummary.lowStock}</span>
                      <span className="text-orange-500 text-sm font-medium">รายการ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Record Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
                  <TableProperties className="text-indigo-500" size={20} />
                  บันทึกข้อมูล (Data Entry)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {hasPermission('stockTableBar') && (
                    <button 
                      onClick={() => setActiveTab('barStock')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <TableProperties size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">สรุปจำนวน Stock บาร์</h4>
                      <p className="text-blue-100 text-xs text-center">บันทึกและจัดการสต็อกสำหรับบาร์</p>
                    </button>
                  )}

                  {hasPermission('stockTableBakery') && (
                    <button 
                      onClick={() => setActiveTab('bakeryStock')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <TableProperties size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">สรุปจำนวน Stock ครัว</h4>
                      <p className="text-rose-100 text-xs text-center">บันทึกและจัดการสต็อกสำหรับครัว</p>
                    </button>
                  )}

                  {hasPermission('bakeryPlan') && (
                    <button 
                      onClick={() => setActiveTab('bakeryPlan')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Calendar size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">แผนงาน Bakery</h4>
                      <p className="text-amber-100 text-xs text-center">บันทึกและจัดการแผนงาน Bakery</p>
                    </button>
                  )}

                  {hasPermission('rndReport') && (
                    <button 
                      onClick={() => setActiveTab('rndReport')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <ChefHat size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">R&D Report</h4>
                      <p className="text-purple-100 text-xs text-center">บันทึกข้อมูลและเทสเมนูใหม่ (New Menu)</p>
                    </button>
                  )}
                </div>
              </div>

              {/* Reports Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
                  <FileUp className="text-emerald-500" size={20} />
                  รายงาน (Reports)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {hasPermission('barReceiving') && (
                    <button 
                      onClick={() => setActiveTab('barReceiving')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <PackageCheck size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">รายงานตรวจรับวัตถุดิบ</h4>
                      <p className="text-emerald-100 text-xs text-center">สำหรับบาร์ ประจำวัน</p>
                    </button>
                  )}

                  {hasPermission('bakeryReceiving') && (
                    <button 
                      onClick={() => setActiveTab('bakeryReceiving')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <PackageCheck size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">รายงานตรวจรับวัตถุดิบ</h4>
                      <p className="text-blue-100 text-xs text-center">สำหรับครัว ประจำวัน</p>
                    </button>
                  )}

                  {hasPermission('dailyStockCountBar') && (
                    <button 
                      onClick={() => setActiveTab('barDailyCount')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <ClipboardCheck size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">รายงานตรวจนับสต็อก</h4>
                      <p className="text-pink-100 text-xs text-center">สำหรับบาร์ ประจำวัน</p>
                    </button>
                  )}

                  {hasPermission('dailyStockCountBakery') && (
                    <button 
                      onClick={() => setActiveTab('bakeryDailyCount')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <ClipboardCheck size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">รายงานตรวจนับสต็อก</h4>
                      <p className="text-violet-100 text-xs text-center">สำหรับครัว ประจำวัน</p>
                    </button>
                  )}

                  {hasPermission('checklistsBar') && (
                    <button 
                      onClick={() => setActiveTab('barChecklist')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <ClipboardList size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">Check-in & Check-out</h4>
                      <p className="text-orange-100 text-xs text-center">บันทึกรายการตรวจสอบบาร์</p>
                    </button>
                  )}

                  {hasPermission('checklistsBakery') && (
                    <button 
                      onClick={() => setActiveTab('bakeryChecklist')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-cyan-500 to-sky-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <ChefHat size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">Check-in & Check-out</h4>
                      <p className="text-cyan-100 text-xs text-center">บันทึกรายการตรวจสอบครัว</p>
                    </button>
                  )}

                  {hasPermission('dailyStockCountBar') && (
                    <button 
                      onClick={() => setActiveTab('barWasteLog')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Trash2 size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">รายงานบันทึกของเสีย</h4>
                      <p className="text-red-100 text-xs text-center">สำหรับบาร์ (Waste)</p>
                    </button>
                  )}

                  {hasPermission('dailyStockCountBakery') && (
                    <button 
                      onClick={() => setActiveTab('bakeryWasteLog')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-stone-500 to-neutral-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Trash2 size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">รายงานบันทึกของเสีย</h4>
                      <p className="text-stone-100 text-xs text-center">สำหรับครัว (Waste)</p>
                    </button>
                  )}

                  {hasPermission('purchasingReport') && (
                    <button 
                      onClick={() => setActiveTab('barPurchasing')}
                      className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition-all text-white group sm:col-span-2"
                    >
                      <div className="bg-white/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <ShoppingCart size={32} />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-center">สรุปยอดสั่งซื้อ (Purchasing)</h4>
                      <p className="text-indigo-100 text-xs text-center">สรุปจากการตรวจนับสต็อก</p>
                    </button>
                  )}
                </div>
              </div>

              {/* Audit Log Section */}
              <div className="space-y-4 lg:col-span-2">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
                  <History className="text-blue-500" size={20} />
                  ประวัติย้อนหลัง
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {hasPermission('historyLogs') && (
                    <button 
                      onClick={() => setActiveTab('logs')}
                      className="flex items-center gap-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                      <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                        <History size={32} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-slate-800 mb-1">ประวัติการแก้ไขข้อมูล</h4>
                        <p className="text-slate-500 text-sm">ตรวจสอบประวัติการแก้ไข 120 รายการล่าสุด</p>
                      </div>
                      <div className="ml-auto p-2 bg-slate-50 rounded-full text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </button>
                  )}

                  {hasPermission('historyChecklist') && (
                    <button 
                      onClick={() => setActiveTab('checklistHistory')}
                      className="flex items-center gap-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                      <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                        <ClipboardList size={32} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-slate-800 mb-1">ประวัติ Check-in & Check-out</h4>
                        <p className="text-slate-500 text-sm">ตรวจสอบรายงานการตรวจสอบบาร์ย้อนหลัง</p>
                      </div>
                      <div className="ml-auto p-2 bg-slate-50 rounded-full text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </button>
                  )}

                  {hasPermission('historyLogs') && (
                    <button 
                      onClick={() => setActiveTab('stockSubmitHistory')}
                      className="flex items-center gap-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                      <div className="bg-sky-50 p-4 rounded-2xl text-sky-600 group-hover:scale-110 transition-transform">
                        <ClipboardList size={32} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-slate-800 mb-1">ประวัติรายงานนับสต็อก</h4>
                        <p className="text-slate-500 text-sm">ตรวจสอบประวัติการส่งรายงานนับสต็อก</p>
                      </div>
                      <div className="ml-auto p-2 bg-slate-50 rounded-full text-slate-400 group-hover:text-sky-600 group-hover:bg-sky-50 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </button>
                  )}

                  {hasPermission('historyWaste') && (
                    <button 
                      onClick={() => setActiveTab('barWaste')}
                      className="flex items-center gap-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                      <div className="bg-red-50 p-4 rounded-2xl text-red-600 group-hover:scale-110 transition-transform">
                        <Trash2 size={32} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-slate-800 mb-1">รายงาน Waste เมล็ดกาแฟ</h4>
                        <p className="text-slate-500 text-sm">สรุปปริมาณการใช้เมล็ดกาแฟรายวัน (Waste)</p>
                      </div>
                      <div className="ml-auto p-2 bg-slate-50 rounded-full text-slate-400 group-hover:text-red-600 group-hover:bg-red-50 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </button>
                  )}

                  {hasPermission('historyReceiving') && (
                    <button 
                      onClick={() => setActiveTab('receivingHistory')}
                      className="flex items-center gap-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
                    >
                      <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                        <Package size={32} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-slate-800 mb-1">ประวัติการรับวัตถุดิบ</h4>
                        <p className="text-slate-500 text-sm">ตรวจสอบรายการรับวัตถุดิบย้อนหลัง</p>
                      </div>
                      <div className="ml-auto p-2 bg-slate-50 rounded-full text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </button>
                  )}

                  {hasPermission('bakeryPlan') && (
                    <button 
                      onClick={() => setActiveTab('bakeryPlanHistory')}
                      className="flex items-center gap-6 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-200 transition-all group"
                    >
                      <div className="bg-amber-50 p-4 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
                        <Calendar size={32} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-lg font-bold text-slate-800 mb-1">ประวัติแผนงาน Bakery</h4>
                        <p className="text-slate-500 text-sm">ตรวจสอบแผนงานย้อนหลัง 24 สัปดาห์</p>
                      </div>
                      <div className="ml-auto p-2 bg-slate-50 rounded-full text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-50 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <Dashboard 
            ingredients={ingredients} 
            stockRecord={stockRecord} 
            allowedDepartments={[
              ...(hasPermission('dashboardBar') ? ['Bar' as const] : []),
              ...(hasPermission('dashboardBakery') ? ['Bakery' as const] : [])
            ]}
          />
        ) : activeTab === 'bakeryPlan' ? (
          <BakeryPlan 
            isReadOnly={isReadOnly('bakeryPlan')} branch={user?.branch} 
            onSave={(weekLabel) => addLog('บันทึกแผนงาน Bakery', 'บันทึกแผนงาน Bakery สัปดาห์ที่ ' + weekLabel)}
          />
        ) : activeTab === 'barReceiving' ? (
          <BarReceiving 
            ingredients={ingredients} 
            receivingRecords={receivingRecords} 
            onAddRecord={handleAddReceivingRecord} 
            onDeleteRecord={handleDeleteReceivingRecord} 
            isReadOnly={isReadOnly('barReceiving')}
          />
        ) : activeTab === 'bakeryReceiving' ? (
          <BarReceiving 
            ingredients={ingredients} 
            receivingRecords={receivingRecords} 
            onAddRecord={handleAddReceivingRecord} 
            onDeleteRecord={handleDeleteReceivingRecord} 
            isReadOnly={isReadOnly('bakeryReceiving')}
            department="Bakery"
          />
        ) : activeTab === 'barDailyCount' ? (
          <DailyStockCount 
            ingredients={ingredients.filter(ing => ing.department === 'Bar')}
            stockRecord={stockRecord}
            onSubmit={(date, counts) => handleSubmitDailyCount(date, counts, 'Bar')}
            isReadOnly={isReadOnly('dailyStockCountBar')}
          />
        ) : activeTab === 'bakeryDailyCount' ? (
          <DailyStockCount 
            ingredients={ingredients.filter(ing => ing.department === 'Bakery')}
            stockRecord={stockRecord}
            onSubmit={(date, counts) => handleSubmitDailyCount(date, counts, 'Bakery')}
            isReadOnly={isReadOnly('dailyStockCountBakery')}
          />
        ) : activeTab === 'logs' ? (
          <AuditLog logs={logs} checklistRecords={checklistRecords} receivingRecords={receivingRecords} ingredients={ingredients} initialTab="logs" onDeleteReceivingRecord={handleDeleteReceivingRecord} isReadOnly={isReadOnly('historyLogs')} />
        ) : activeTab === 'stockSubmitHistory' ? (
          <AuditLog logs={logs} checklistRecords={checklistRecords} receivingRecords={receivingRecords} ingredients={ingredients} initialTab="stockSubmit" onDeleteReceivingRecord={handleDeleteReceivingRecord} isReadOnly={isReadOnly('historyLogs')} />
        ) : activeTab === 'checklistHistory' ? (
          <AuditLog logs={logs} checklistRecords={checklistRecords} receivingRecords={receivingRecords} ingredients={ingredients} initialTab="checklist" onDeleteReceivingRecord={handleDeleteReceivingRecord} isReadOnly={isReadOnly('historyChecklist')} />
        ) : activeTab === 'receivingHistory' ? (
          <AuditLog logs={logs} checklistRecords={checklistRecords} receivingRecords={receivingRecords} ingredients={ingredients} initialTab="receiving" onDeleteReceivingRecord={handleDeleteReceivingRecord} isReadOnly={isReadOnly('historyReceiving')} />
        ) : activeTab === 'bakeryPlanHistory' ? (
          <BakeryPlanHistory onBack={() => setActiveTab('home')} />
        ) : activeTab === 'barChecklist' ? (
          <BarChecklist ingredients={ingredients} onSave={handleSaveChecklist} user={user} checklistRecords={checklistRecords} isReadOnly={isReadOnly('checklistsBar')} />
        ) : activeTab === 'bakeryChecklist' ? (
          <BakeryChecklist onSave={handleSaveChecklist} user={user} checklistRecords={checklistRecords} isReadOnly={isReadOnly('checklistsBakery')} />
        ) : activeTab === 'barWaste' ? (
          <BarWasteReport ingredients={ingredients} checklistRecords={checklistRecords} />
        ) : activeTab === 'barWasteLog' ? (
          <WasteReport department="Bar" ingredients={ingredients} wasteLogs={wasteLogs} currentUser={user?.name || 'Unknown'} onSave={addWasteLog} onUpdate={updateWasteLog} onBack={() => setActiveTab('home')} />
        ) : activeTab === 'bakeryWasteLog' ? (
          <WasteReport department="Bakery" ingredients={ingredients} wasteLogs={wasteLogs} currentUser={user?.name || 'Unknown'} onSave={addWasteLog} onUpdate={updateWasteLog} onBack={() => setActiveTab('home')} />
        ) : activeTab === 'rndReport' ? (
          <RnDReport reports={rndReports} currentUser={user?.name || 'Unknown'} onSave={addRnDReport} onUpdate={updateRnDReport} onBack={() => setActiveTab('home')} />
        ) : activeTab === 'barPurchasing' ? (
          <PurchasingReport ingredients={ingredients} stockRecord={stockRecord} onBack={() => setActiveTab('home')} />
        ) : activeTab === 'userSettings' ? (
          <UserSettings currentUser={user} onCurrentUserUpdated={setUser} branch={user?.branch} />
        ) : (
          <>
            {/* Date Range Controls for Stock Recording */}
            <div className="flex items-center justify-between mb-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1.5">
                  <input 
                    type="date" 
                    value={format(dateRange.start, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const [y, m, d] = e.target.value.split('-');
                      const newStart = new Date(Number(y), Number(m) - 1, Number(d));
                      let newEnd = dateRange.end;
                      if (newEnd < newStart) newEnd = newStart;
                      if (differenceInDays(newEnd, newStart) > 6) {
                        newEnd = addDays(newStart, 6);
                      }
                      setDateRange({ start: newStart, end: newEnd });
                    }}
                    className="bg-white border border-slate-300 rounded text-sm px-2 py-1 focus:outline-none focus:border-blue-500 font-mono text-slate-700"
                  />
                  <span className="text-slate-500 text-sm font-medium">ถึง</span>
                  <input 
                    type="date" 
                    value={format(dateRange.end, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const [y, m, d] = e.target.value.split('-');
                      const newEnd = new Date(Number(y), Number(m) - 1, Number(d));
                      let newStart = dateRange.start;
                      if (newStart > newEnd) newStart = newEnd;
                      if (differenceInDays(newEnd, newStart) > 6) {
                        newStart = subDays(newEnd, 6);
                      }
                      setDateRange({ start: newStart, end: newEnd });
                    }}
                    min={format(dateRange.start, 'yyyy-MM-dd')}
                    max={format(addDays(dateRange.start, 6), 'yyyy-MM-dd')}
                    className="bg-white border border-slate-300 rounded text-sm px-2 py-1 focus:outline-none focus:border-blue-500 font-mono text-slate-700"
                  />
                </div>
                <button 
                  onClick={() => setDateRange({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6) })}
                  className="text-[12px] text-blue-600 hover:text-blue-700 font-bold px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-all"
                >
                  This Week
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button 
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all shadow-sm"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo size={14} />
                  </button>
                  <button 
                    onClick={handleRedo}
                    disabled={future.length === 0}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-all shadow-sm"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Action Bar (above table) */}
            <div className="flex justify-between items-center gap-2 mb-3 flex-wrap">
              <div>
                <button
                  onClick={() => {
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    setDateRange({ start: today, end: today });
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all shadow-sm transform hover:scale-105 active:scale-95 border bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Calendar size={14} className="text-blue-500" />
                  Today
                </button>
              </div>
              <div className="flex justify-end gap-2 flex-wrap">
              {hasPermission('manageIngredients') && (
                <>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileUpload} 
                  />
                  <button
                    onClick={handleImportExcel}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-emerald-500 transition-all shadow-sm transform hover:scale-105 active:scale-95 border border-emerald-500"
                  >
                    <FileUp size={14} strokeWidth={3} />
                    Import Excel
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExportDropdownOpen(!isExportDropdownOpen);
                      }}
                      className="flex items-center gap-1.5 bg-slate-700 text-white px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-slate-600 transition-all shadow-sm transform hover:scale-105 active:scale-95 border border-slate-600"
                    >
                      <FileDown size={14} strokeWidth={3} />
                      Export File
                      <ChevronDown size={12} className={cn("transition-transform", isExportDropdownOpen && "rotate-180")} />
                    </button>
                    
                    {isExportDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={() => {
                            exportExcel();
                            setIsExportDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                        >
                          <FileDown size={14} className="text-emerald-600" />
                          Excel (.xlsx)
                        </button>
                        <button
                          onClick={() => {
                            handlePrint();
                            setIsExportDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                        >
                          <Printer size={14} className="text-blue-600" />
                          PDF / Print
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-blue-500 transition-all shadow-sm transform hover:scale-105 active:scale-95 border border-blue-500"
                  >
                    <Plus size={14} strokeWidth={3} />
                    เพิ่มรายการวัตถุดิบ
                  </button>
                </>
              )}
              </div>
            </div>

            {/* Main Table */}
            <StockTable 
              ingredients={ingredients.filter(ing => ing.department === (activeTab === 'barStock' ? 'Bar' : 'Bakery'))}
              stockRecord={stockRecord}
              dateRange={dateRange}
              onUpdateStock={handleUpdateStock}
              onClearIngredientWeek={handleClearIngredientWeek}
              onClearDay={handleClearDay}
              onDeleteIngredient={handleDeleteIngredient}
              onEditIngredient={setEditingIngredient}
              userRole={user.role}
              isReadOnly={isReadOnly(activeTab === 'barStock' ? 'stockTableBar' : 'stockTableBakery')}
              
            />
          </>
        )}

        {/* Bottom Actions Zone */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <div>
            {activeTab !== 'home' && (
              <button 
                id="back-to-home-bottom-btn"
                onClick={() => {
                  setActiveTab('home');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all shadow-sm hover:shadow active:scale-95 duration-150 cursor-pointer"
              >
                <ChevronLeft size={18} className="text-slate-500" />
                ย้อนกลับหน้าหลัก
              </button>
            )}
          </div>
          
          <button 
            id="scroll-to-top-btn"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all shadow-sm hover:shadow active:scale-95 duration-150 ml-auto sm:ml-0 cursor-pointer"
          >
            <ChevronUp size={18} />
            เลื่อนขึ้นบนสุด
          </button>
        </div>

      </main>

      {isFormOpen && (
        <IngredientForm 
          defaultDepartment={activeTab === 'bakeryStock' ? 'Bakery' : 'Bar'}
          onSubmit={handleAddIngredient} 
          onClose={() => setIsFormOpen(false)} 
        />
      )}

      {editingIngredient && (
        <IngredientForm
          initialData={editingIngredient}
          defaultDepartment={activeTab === 'bakeryStock' ? 'Bakery' : 'Bar'}
          onSubmit={handleEditIngredient}
          onClose={() => setEditingIngredient(null)}
        />
      )}
    </div>
  );
}
