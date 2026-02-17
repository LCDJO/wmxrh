/**
 * Module icon mapping for notification source_module.
 * Maps known module slugs to Lucide icon names.
 */

import {
  Users, Building2, Shield, FileText, Briefcase, Heart,
  GraduationCap, Calculator, Scale, AlertTriangle, Brain,
  Settings, Bell, type LucideIcon,
} from 'lucide-react';

const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  employee: Users,
  employees: Users,
  company: Building2,
  companies: Building2,
  iam: Shield,
  security: Shield,
  agreement: FileText,
  agreements: FileText,
  documents: FileText,
  compensation: Briefcase,
  salary: Briefcase,
  health: Heart,
  pcmso: Heart,
  training: GraduationCap,
  'nr-training': GraduationCap,
  payroll: Calculator,
  'payroll-simulation': Calculator,
  labor: Scale,
  'labor-rules': Scale,
  compliance: AlertTriangle,
  esocial: AlertTriangle,
  intelligence: Brain,
  'workforce-intelligence': Brain,
  cognitive: Brain,
  platform: Settings,
};

export function getModuleIcon(sourceModule?: string | null): LucideIcon {
  if (!sourceModule) return Bell;
  const key = sourceModule.toLowerCase().trim();
  return MODULE_ICON_MAP[key] ?? Bell;
}
