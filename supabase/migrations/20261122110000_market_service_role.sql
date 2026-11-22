-- Correctif de 20261122100000_market : le collecteur (rôle service_role) n'avait aucun droit sur
-- les tables du marché. Droits minimaux : lire le catalogue, marquer l'historique comme chargé,
-- écrire les prix et l'historique. Il ne peut ni créer, ni supprimer de crypto du catalogue.

grant select on public.coins to service_role;
grant update (history_loaded_at) on public.coins to service_role;
grant select, insert, update on public.prices to service_role;
grant select, insert, update on public.price_history to service_role;
