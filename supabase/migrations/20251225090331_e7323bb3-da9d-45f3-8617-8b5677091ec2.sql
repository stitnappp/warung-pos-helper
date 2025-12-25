-- Insert Midtrans settings into app_settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('midtrans_merchant_id', '', 'Midtrans Merchant ID'),
  ('midtrans_client_key', '', 'Midtrans Client Key (publishable)'),
  ('midtrans_server_key', '', 'Midtrans Server Key (secret)'),
  ('midtrans_environment', 'sandbox', 'Midtrans environment: sandbox or production')
ON CONFLICT (key) DO NOTHING;