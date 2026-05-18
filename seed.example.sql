INSERT OR IGNORE INTO households (id, name)
VALUES ('household_piero_barbara', 'Piero and Barbara');

INSERT OR IGNORE INTO users (id, household_id, display_name, role)
VALUES
  ('user_piero', 'household_piero_barbara', 'Piero', 'owner'),
  ('user_barbara', 'household_piero_barbara', 'Barbara', 'member');

INSERT OR IGNORE INTO plans (id, household_id, title, focus, status, version)
VALUES (
  'plan_current_4_day',
  'household_piero_barbara',
  '4 giorni facili da cucinare',
  'family-friendly, protein, fibre, easy prep',
  'active',
  1
);

INSERT OR IGNORE INTO recipes (
  id,
  household_id,
  title,
  summary,
  ingredients_json,
  method_json,
  tags_json,
  effort,
  family_notes
) VALUES
  (
    'recipe_traybake_salmon_chicken',
    'household_piero_barbara',
    'Salmone o pollo traybake',
    'Traybake with salmon or chicken, sweet potatoes and broccoli.',
    '["Salmone o chicken thighs/breast", "Sweet potatoes", "Broccoli", "Olive oil", "Adult toppings: lemon, chilli flakes, soy sauce, parmesan"]',
    '["Roast sweet potatoes with oil at 200C.", "Add broccoli and salmon/chicken until cooked.", "Keep baby portion plain.", "Save extra vegetables or sweet potato for leftovers."]',
    '["Giorno 1 cena", "35 min", "leftover friendly"]',
    'easy',
    'Keep Gaia portion soft and unsalted; add adult toppings at the end.'
  ),
  (
    'recipe_pasta_lentils_spinach',
    'household_piero_barbara',
    'Pasta pomodoro, lenticchie e spinaci',
    'Simple tomato, lentil and spinach pasta.',
    '["Pasta", "Tinned tomatoes or passata", "Lentils", "Spinach", "Olive oil", "Adult toppings: parmesan, chilli, black pepper"]',
    '["Warm passata and lentils with oil and mild spices.", "Cook pasta soft and keep pasta water.", "Add chopped spinach to sauce.", "Serve baby portion plain; add adult toppings at the end."]',
    '["Giorno 2 cena", "25 min", "fibra facile"]',
    'easy',
    'Good gentle fibre option; keep baby sauce simple.'
  ),
  (
    'recipe_turkey_chicken_rice_bowl',
    'household_piero_barbara',
    'Rice bowl tacchino, courgette e peas',
    'Turkey or chicken mince rice bowl with courgette, peas and tomato.',
    '["Turkey/chicken mince", "Rice", "Courgette", "Peas", "Tinned tomatoes or passata", "Adult toppings: soy sauce, hot sauce, chilli flakes"]',
    '["Cook rice or use microwave rice.", "Brown mince with grated courgette and peas.", "Add tomato and cook until soft.", "Set aside baby portion before salt or spicy toppings."]',
    '["Giorno 3 cena", "30 min", "high protein"]',
    'easy',
    'Good protein base; baby portion plain and soft.'
  ),
  (
    'recipe_chicken_lentil_stew',
    'household_piero_barbara',
    'Stew pollo, lenticchie e verdure',
    'Chicken, lentil and vegetable stew with bread.',
    '["Chicken", "Lentils", "Carrots", "Spinach or broccoli", "Tinned tomatoes or passata", "Low/no-salt stock optional", "Bread"]',
    '["Cook small chicken pieces with carrots and oil.", "Add lentils, tomato and stock/water; simmer until thick.", "Add spinach or cooked broccoli near the end.", "Serve warm and soft for Gaia; season adult portions separately."]',
    '["Giorno 4 cena", "35 min", "batchable"]',
    'easy',
    'Serve warm, dense, and soft for Gaia.'
  );

INSERT OR IGNORE INTO plan_meals (id, plan_id, recipe_id, day_index, slot, title, notes, baby_notes)
VALUES
  ('meal_d1_dinner', 'plan_current_4_day', 'recipe_traybake_salmon_chicken', 1, 'dinner', 'Salmone o pollo al forno, sweet potato, broccoli', 'Adult toppings at the end.', 'Pezzi morbidi, broccoli ben cotti, niente sale.'),
  ('meal_d2_dinner', 'plan_current_4_day', 'recipe_pasta_lentils_spinach', 2, 'dinner', 'Pasta con pomodoro, lenticchie e spinaci', 'Good fibre/protein dinner.', 'Pasta ben cotta, salsa semplice, spinaci tritati.'),
  ('meal_d3_dinner', 'plan_current_4_day', 'recipe_turkey_chicken_rice_bowl', 3, 'dinner', 'Rice bowl con macinato tacchino/pollo, pomodoro, courgette e peas', 'Keep hot sauce separate.', 'Porzione plain, morbida, senza spicy sauce.'),
  ('meal_d4_dinner', 'plan_current_4_day', 'recipe_chicken_lentil_stew', 4, 'dinner', 'Stew di lenticchie, pollo e verdure, con pane', 'Batchable dinner.', 'Texture densa, pezzi piccoli e morbidi, servire tiepido.');

INSERT OR IGNORE INTO check_items (id, plan_id, scope, label, category, position)
VALUES
  ('check_decision_salmon_chicken', 'plan_current_4_day', 'decisions', 'Salmone o pollo per la traybake?', 'decision', 1),
  ('check_decision_mince', 'plan_current_4_day', 'decisions', 'Macinato di tacchino o pollo?', 'decision', 2),
  ('check_decision_soup', 'plan_current_4_day', 'decisions', 'Zuppa/stew da zero o backup pronto?', 'decision', 3),
  ('check_decision_lunches', 'plan_current_4_day', 'decisions', 'Pranzi: wraps, rice bowls, o leftovers?', 'decision', 4),
  ('check_decision_swaps', 'plan_current_4_day', 'decisions', 'Cose da togliere o scambiare?', 'decision', 5),
  ('check_grocery_chicken', 'plan_current_4_day', 'grocery', 'Chicken breast o thighs', 'Proteine', 1),
  ('check_grocery_salmon', 'plan_current_4_day', 'grocery', 'Salmon fillets, oppure extra chicken', 'Proteine', 2),
  ('check_grocery_mince', 'plan_current_4_day', 'grocery', 'Turkey o chicken mince', 'Proteine', 3),
  ('check_grocery_tuna', 'plan_current_4_day', 'grocery', 'Tuna tins', 'Proteine', 4),
  ('check_grocery_eggs', 'plan_current_4_day', 'grocery', 'Eggs', 'Proteine', 5),
  ('check_grocery_yogurt', 'plan_current_4_day', 'grocery', 'Greek yogurt plain', 'Proteine', 6),
  ('check_grocery_cottage_cheese', 'plan_current_4_day', 'grocery', 'Cottage cheese', 'Proteine', 7),
  ('check_grocery_cream_cheese', 'plan_current_4_day', 'grocery', 'Cream cheese', 'Proteine', 8),
  ('check_grocery_lentils', 'plan_current_4_day', 'grocery', 'Lentils', 'Proteine', 9),
  ('check_grocery_wraps', 'plan_current_4_day', 'grocery', 'Wraps', 'Carbs', 1),
  ('check_grocery_rice', 'plan_current_4_day', 'grocery', 'Rice o microwave rice', 'Carbs', 2),
  ('check_grocery_sweet_potatoes', 'plan_current_4_day', 'grocery', 'Sweet potatoes', 'Carbs', 3),
  ('check_grocery_pasta', 'plan_current_4_day', 'grocery', 'Pasta', 'Carbs', 4),
  ('check_grocery_bread', 'plan_current_4_day', 'grocery', 'Bread', 'Carbs', 5),
  ('check_grocery_oats', 'plan_current_4_day', 'grocery', 'Oats', 'Carbs', 6),
  ('check_grocery_rice_cakes', 'plan_current_4_day', 'grocery', 'Rice cakes o crackers', 'Carbs', 7),
  ('check_grocery_salad', 'plan_current_4_day', 'grocery', 'Salad bag', 'Frutta e verdura', 1),
  ('check_grocery_broccoli', 'plan_current_4_day', 'grocery', 'Broccoli', 'Frutta e verdura', 2),
  ('check_grocery_spinach', 'plan_current_4_day', 'grocery', 'Spinach', 'Frutta e verdura', 3),
  ('check_grocery_courgette', 'plan_current_4_day', 'grocery', 'Courgette', 'Frutta e verdura', 4),
  ('check_grocery_peas', 'plan_current_4_day', 'grocery', 'Peas', 'Frutta e verdura', 5),
  ('check_grocery_cucumber', 'plan_current_4_day', 'grocery', 'Cucumber', 'Frutta e verdura', 6),
  ('check_grocery_carrots', 'plan_current_4_day', 'grocery', 'Carrots', 'Frutta e verdura', 7),
  ('check_grocery_bananas', 'plan_current_4_day', 'grocery', 'Bananas', 'Frutta e verdura', 8),
  ('check_grocery_berries', 'plan_current_4_day', 'grocery', 'Berries', 'Frutta e verdura', 9),
  ('check_grocery_apples', 'plan_current_4_day', 'grocery', 'Apples', 'Frutta e verdura', 10),
  ('check_grocery_avocados', 'plan_current_4_day', 'grocery', 'Avocados', 'Frutta e verdura', 11),
  ('check_grocery_passata', 'plan_current_4_day', 'grocery', 'Tinned tomatoes o passata', 'Cupboard', 1),
  ('check_grocery_hummus', 'plan_current_4_day', 'grocery', 'Hummus', 'Cupboard', 2),
  ('check_grocery_olive_oil', 'plan_current_4_day', 'grocery', 'Olive oil', 'Cupboard', 3),
  ('check_grocery_mild_spices', 'plan_current_4_day', 'grocery', 'Mild spices', 'Cupboard', 4),
  ('check_grocery_stock', 'plan_current_4_day', 'grocery', 'Low/no-salt stock, optional', 'Cupboard', 5),
  ('check_grocery_soy_sauce', 'plan_current_4_day', 'grocery', 'Soy sauce', 'Cupboard', 6),
  ('check_grocery_chilli', 'plan_current_4_day', 'grocery', 'Chilli flakes o hot sauce', 'Cupboard', 7),
  ('check_grocery_parmesan', 'plan_current_4_day', 'grocery', 'Parmesan', 'Cupboard', 8),
  ('check_prep_roast_extra', 'plan_current_4_day', 'prep', 'Roast extra sweet potato e broccoli il giorno 1.', 'prep', 1),
  ('check_prep_extra_rice', 'plan_current_4_day', 'prep', 'Cook extra rice per il pranzo del giorno 2.', 'prep', 2),
  ('check_prep_extra_sauce', 'plan_current_4_day', 'prep', 'Make extra tomato/lentil sauce per leftovers.', 'prep', 3),
  ('check_prep_fallbacks', 'plan_current_4_day', 'prep', 'Tenere yogurt, banana, eggs e rice cakes come fallback.', 'prep', 4);
