begin;
create table reev_private.receipts(message_id text primary key,status text not null,updated_at timestamptz not null default now());
create function public.reev_receipt(message_id text,new_status text) returns void language plpgsql security definer set search_path='' as $$begin
 if new_status not in ('sent','delivered','read','failed') then raise exception 'Invalid receipt';end if;
 insert into reev_private.receipts(message_id,status) values(reev_receipt.message_id,new_status) on conflict on constraint receipts_pkey do update set status=case when reev_private.receipts.status='read' then 'read' when reev_private.receipts.status='delivered' and excluded.status<>'read' then 'delivered' else excluded.status end,updated_at=now();
 update public.wa_outbox w set status=r.status,updated_at=now() from reev_private.receipts r where w.gateway_id=reev_receipt.message_id and r.message_id=w.gateway_id;
end$$;
create function public.reev_finish_reply(key text,final_status text,message_id text) returns void language plpgsql security definer set search_path='' as $$begin
 if final_status not in ('sent','delivered','read','failed','unknown') then raise exception 'Invalid send status';end if;
 update public.wa_outbox set status=coalesce((select status from reev_private.receipts r where r.message_id=reev_finish_reply.message_id),final_status),gateway_id=message_id,updated_at=now() where event_key=key and status='sending';
end$$;
revoke all on function public.reev_receipt(text,text),public.reev_finish_reply(text,text,text) from public,anon,authenticated;
grant execute on function public.reev_receipt(text,text),public.reev_finish_reply(text,text,text) to service_role;
commit;
