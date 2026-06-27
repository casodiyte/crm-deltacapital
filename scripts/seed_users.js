import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kzemdiggdpxfceiecbat.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6ZW1kaWdnZHB4ZmNlaWVjYmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NjI0NCwiZXhwIjoyMDk2ODYyMjQ0fQ.XS6MAl0X4W_M8A3Q8K2zw2PwjEfelwj8KH8xKZXCRLw';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const GLOBAL_PASSWORD = 'Qwerty123456*';

const users = [
  {
    email: 'ejecutivo.4.tradingworld@gmail.com',
    firstName: 'Erick',
    lastName: 'Vallarta',
    role: 'SUPERADMIN',
    department: 'gerente'
  },
  {
    email: 'veroramirezmat@gmail.com',
    firstName: 'Carlos',
    lastName: 'Ismael',
    role: 'AGENT',
    department: 'ventas'
  },
  {
    email: 'michellegarciacaba@gmail.com',
    firstName: 'Matias',
    lastName: 'Villanueva',
    role: 'AGENT',
    department: 'retencion'
  },
  {
    email: 'benjaminventassaenz@gmail.com',
    firstName: 'Julieta',
    lastName: 'Castillo',
    role: 'MANAGER',
    department: 'gerente'
  },
  {
    email: 'margaritatalavera59@gmail.com',
    firstName: 'Paola',
    lastName: 'Chavez',
    role: 'AGENT',
    department: 'ventas'
  },
];

async function createUsers() {
  console.log('🚀 Iniciando creación de usuarios (sin verificación de correo)...\n');

  for (const user of users) {
    console.log(`📧 Procesando: ${user.email} (${user.firstName} ${user.lastName} - ${user.role})`);

    // 1. Crear el usuario en auth.users con email ya confirmado
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: GLOBAL_PASSWORD,
      email_confirm: true, // Sin verificación de correo
      user_metadata: {
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        department: user.department
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already registered')) {
        console.log(`   ⚠️  Ya existe en auth. Intentando actualizar perfil...`);
        // Buscar el usuario existente
        const { data: existing } = await supabase.auth.admin.listUsers();
        const existingUser = existing?.users?.find(u => u.email === user.email);
        if (existingUser) {
          await insertOrUpdateProfile(existingUser.id, user);
        }
      } else {
        console.error(`   ❌ Error auth: ${authError.message}`);
      }
      continue;
    }

    if (!authData?.user) {
      console.error(`   ❌ No se retornó el usuario`);
      continue;
    }

    console.log(`   ✅ Auth creado: ${authData.user.id}`);

    // 2. Insertar manualmente en profiles (nuestra tabla personalizada)
    await insertOrUpdateProfile(authData.user.id, user);
  }

  console.log('\n🏁 Proceso finalizado.');
}

async function insertOrUpdateProfile(userId, user) {
  // Verificar si ya existe en profiles
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (existing) {
    // Actualizar
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        active: true
      })
      .eq('id', userId);

    if (error) {
      console.error(`   ❌ Error actualizando profile: ${error.message}`);
    } else {
      console.log(`   ✅ Profile actualizado en tabla profiles`);
    }
  } else {
    // Insertar nuevo
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        active: true
      });

    if (error) {
      console.error(`   ❌ Error insertando profile: ${error.message}`);
    } else {
      console.log(`   ✅ Profile insertado en tabla profiles`);
    }
  }
}

createUsers();
