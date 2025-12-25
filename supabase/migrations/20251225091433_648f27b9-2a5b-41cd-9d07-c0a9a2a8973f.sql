-- Insert printer settings into app_settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('printer_address', '', 'Saved thermal printer MAC address'),
  ('printer_name', '', 'Saved thermal printer name')
ON CONFLICT (key) DO NOTHING;