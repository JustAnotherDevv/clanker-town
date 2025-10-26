module game_nft::resource_game {
    use sui::object;
    use sui::transfer;
    use sui::tx_context;
    use sui::clock::{Self, Clock};
    use sui::event;

    // ===== Errors =====
    const E_NOT_PARTICIPANT: u64 = 1;
    const E_GENERATOR_OCCUPIED: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_INSUFFICIENT_RESOURCES: u64 = 4;

    // ===== Constants =====
    const GENERATION_INTERVAL_MS: u64 = 60000; // 1 min
    const BASE_GENERATION: u64 = 10;
    const BASE_CAP: u64 = 1000;

    // Resource types
    const WOOD: u8 = 0;
    const STONE: u8 = 1;

    // ===== Game Object =====
    public struct GameMatch has key, store {
        id: UID,
        creator: address,
        participants: vector<address>,
    }

    public struct PlayerResources has key, store {
        id: UID,
        game_id: ID,
        owner: address,
        wood: u64,
        stone: u64,
        emerald: u64,
    }

    public struct Generator has key, store {
        id: UID,
        game_id: ID,
        resource_type: u8,
        x: u64,
        y: u64,
        owner: address, 
        level: u64,
        generation_rate: u64,
        max_cap: u64,
        unclaimed: u64,
        last_claim_time: u64,
        last_recaptured_by: address, 
        last_recaptured_from: address,
    }

    public struct TradeProposal has key, store {
        id: UID,
        game_id: ID,
        proposer: address,
        target: address,
        wood_offered: u64,
        stone_offered: u64,
        emerald_offered: u64,
        wood_requested: u64,
        stone_requested: u64,
        emerald_requested: u64,
    }

    public struct MatchCreated has copy, drop {
        game_id: ID,
        creator: address,
    }

    public struct GeneratorClaimed has copy, drop {
        generator_id: ID,
        claimer: address,
    }

    public struct GeneratorRecaptured has copy, drop {
        generator_id: ID,
        recapturer: address,
        previous_owner: address,
        stolen: u64,
    }

    public struct ResourcesTraded has copy, drop {
        from: address,
        to: address,
        wood_given: u64,
        stone_given: u64,
        emerald_given: u64,
    }

    public struct TradeProposed has copy, drop {
        proposal_id: ID,
        proposer: address,
        target: address,
    }

    public struct TradeAccepted has copy, drop {
        proposal_id: ID,
        proposer: address,
        accepter: address,
    }

    public struct TradeCancelled has copy, drop {
        proposal_id: ID,
        cancelled_by: address,
    }

    public entry fun create_match(
        participants: vector<address>,
        initial_wood: u64,
        initial_stone: u64,
        initial_emerald: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let game_uid = object::new(ctx);
        let game_id = object::uid_to_inner(&game_uid);

        let game = GameMatch {
            id: game_uid,
            creator: sender,
            participants,
        };

        event::emit(MatchCreated {
            game_id,
            creator: sender,
        });

        let mut i = 0;
        let len = vector::length(&participants);
        while (i < len) {
            let participant = *vector::borrow(&participants, i);
            let resources = PlayerResources {
                id: object::new(ctx),
                game_id,
                owner: participant,
                wood: initial_wood,
                stone: initial_stone,
                emerald: initial_emerald,
            };
            transfer::transfer(resources, participant);
            i = i + 1;
        };

        transfer::share_object(game);
    }

    public entry fun create_generators(
        game: &GameMatch,
        resource_type: u8,
        x_coords: vector<u64>,
        y_coords: vector<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == game.creator, E_NOT_PARTICIPANT);

        let game_id = object::uid_to_inner(&game.id);
        let current_time = clock::timestamp_ms(clock);
        let mut i = 0;
        let len = vector::length(&x_coords);

        while (i < len) {
            let x = *vector::borrow(&x_coords, i);
            let y = *vector::borrow(&y_coords, i);

            let generator = Generator {
                id: object::new(ctx),
                game_id,
                resource_type,
                x,
                y,
                owner: @0x0, 
                level: 0,
                generation_rate: BASE_GENERATION,
                max_cap: BASE_CAP,
                unclaimed: 0,
                last_claim_time: current_time,
                last_recaptured_by: @0x0,
                last_recaptured_from: @0x0,
            };
            transfer::share_object(generator);
            i = i + 1;
        };
    }

    public entry fun claim_generator(
        game: &GameMatch,
        generator: &mut Generator,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(vector::contains(&game.participants, &sender), E_NOT_PARTICIPANT);
        assert!(generator.owner == @0x0, E_GENERATOR_OCCUPIED);

        generator.owner = sender;
        generator.last_claim_time = clock::timestamp_ms(clock);

        event::emit(GeneratorClaimed {
            generator_id: object::uid_to_inner(&generator.id),
            claimer: sender,
        });
    }

    public entry fun claim_resources(
        generator: &mut Generator,
        player_resources: &mut PlayerResources,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(generator.owner == sender, E_NOT_OWNER);
        assert!(player_resources.owner == sender, E_NOT_OWNER);

        let current_time = clock::timestamp_ms(clock);
        let time_diff = current_time - generator.last_claim_time;
        let intervals = time_diff / GENERATION_INTERVAL_MS;
        let generated = intervals * generator.generation_rate;
        let total = generator.unclaimed + generated;
        let to_claim = if (total > generator.max_cap) { generator.max_cap } else { total };

        if (to_claim > 0) {
            if (generator.resource_type == WOOD) {
                player_resources.wood = player_resources.wood + to_claim;
            } else if (generator.resource_type == STONE) {
                player_resources.stone = player_resources.stone + to_claim;
            } else {
                player_resources.emerald = player_resources.emerald + to_claim;
            };

            generator.unclaimed = 0;
            generator.last_claim_time = current_time;
        };
    }

    public entry fun upgrade_generator(
        generator: &mut Generator,
        player_resources: &mut PlayerResources,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(generator.owner == sender, E_NOT_OWNER);
        assert!(player_resources.owner == sender, E_NOT_OWNER);

        let base_cost = 100;
        let cost = base_cost * (generator.level + 1);

        assert!(player_resources.wood >= cost, E_INSUFFICIENT_RESOURCES);
        assert!(player_resources.stone >= cost, E_INSUFFICIENT_RESOURCES);
        assert!(player_resources.emerald >= cost / 2, E_INSUFFICIENT_RESOURCES);

        player_resources.wood = player_resources.wood - cost;
        player_resources.stone = player_resources.stone - cost;
        player_resources.emerald = player_resources.emerald - (cost / 2);

        generator.level = generator.level + 1;
        generator.generation_rate = BASE_GENERATION * 2 * (generator.level + 1);
        generator.max_cap = BASE_CAP * (generator.level + 1);
    }

    public entry fun recapture_generator(
        game: &GameMatch,
        generator: &mut Generator,
        attacker_resources: &mut PlayerResources,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(vector::contains(&game.participants, &sender), E_NOT_PARTICIPANT);
        assert!(generator.owner != @0x0, E_NOT_OWNER);
        assert!(generator.owner != sender, E_NOT_OWNER);

        let previous_owner = generator.owner;
        let current_time = clock::timestamp_ms(clock);
        
        let time_diff = current_time - generator.last_claim_time;
        let intervals = time_diff / GENERATION_INTERVAL_MS;
        let generated = intervals * generator.generation_rate;
        let total = generator.unclaimed + generated;
        let stolen = if (total > generator.max_cap) { generator.max_cap } else { total };

        if (stolen > 0) {
            if (generator.resource_type == WOOD) {
                attacker_resources.wood = attacker_resources.wood + stolen;
            } else if (generator.resource_type == STONE) {
                attacker_resources.stone = attacker_resources.stone + stolen;
            } else {
                attacker_resources.emerald = attacker_resources.emerald + stolen;
            };
        };

        generator.owner = sender;
        generator.level = 0;
        generator.generation_rate = BASE_GENERATION;
        generator.max_cap = BASE_CAP;
        generator.unclaimed = 0;
        generator.last_claim_time = current_time;
        generator.last_recaptured_by = sender;
        generator.last_recaptured_from = previous_owner;

        event::emit(GeneratorRecaptured {
            generator_id: object::uid_to_inner(&generator.id),
            recapturer: sender,
            previous_owner,
            stolen,
        });
    }

    public entry fun propose_trade(
        game: &GameMatch,
        proposer_resources: &PlayerResources,
        target: address,
        wood_offer: u64,
        stone_offer: u64,
        emerald_offer: u64,
        wood_request: u64,
        stone_request: u64,
        emerald_request: u64,
        ctx: &mut TxContext
    ) {
        let proposer = tx_context::sender(ctx);
        assert!(proposer_resources.owner == proposer, E_NOT_OWNER);
        assert!(vector::contains(&game.participants, &proposer), E_NOT_PARTICIPANT);
        assert!(vector::contains(&game.participants, &target), E_NOT_PARTICIPANT);

        assert!(proposer_resources.wood >= wood_offer, E_INSUFFICIENT_RESOURCES);
        assert!(proposer_resources.stone >= stone_offer, E_INSUFFICIENT_RESOURCES);
        assert!(proposer_resources.emerald >= emerald_offer, E_INSUFFICIENT_RESOURCES);

        let proposal_uid = object::new(ctx);
        let proposal_id = object::uid_to_inner(&proposal_uid);

        let proposal = TradeProposal {
            id: proposal_uid,
            game_id: object::uid_to_inner(&game.id),
            proposer,
            target,
            wood_offered: wood_offer,
            stone_offered: stone_offer,
            emerald_offered: emerald_offer,
            wood_requested: wood_request,
            stone_requested: stone_request,
            emerald_requested: emerald_request,
        };

        event::emit(TradeProposed {
            proposal_id,
            proposer,
            target,
        });

        transfer::share_object(proposal);
    }

    public entry fun accept_trade(
        proposal: TradeProposal,
        proposer_resources: &mut PlayerResources,
        accepter_resources: &mut PlayerResources,
        ctx: &mut TxContext
    ) {
        let accepter = tx_context::sender(ctx);
        assert!(accepter == proposal.target, E_NOT_OWNER);
        assert!(accepter_resources.owner == accepter, E_NOT_OWNER);
        assert!(proposer_resources.owner == proposal.proposer, E_NOT_OWNER);

        assert!(proposer_resources.wood >= proposal.wood_offered, E_INSUFFICIENT_RESOURCES);
        assert!(proposer_resources.stone >= proposal.stone_offered, E_INSUFFICIENT_RESOURCES);
        assert!(proposer_resources.emerald >= proposal.emerald_offered, E_INSUFFICIENT_RESOURCES);

        assert!(accepter_resources.wood >= proposal.wood_requested, E_INSUFFICIENT_RESOURCES);
        assert!(accepter_resources.stone >= proposal.stone_requested, E_INSUFFICIENT_RESOURCES);
        assert!(accepter_resources.emerald >= proposal.emerald_requested, E_INSUFFICIENT_RESOURCES);

        proposer_resources.wood = proposer_resources.wood - proposal.wood_offered + proposal.wood_requested;
        proposer_resources.stone = proposer_resources.stone - proposal.stone_offered + proposal.stone_requested;
        proposer_resources.emerald = proposer_resources.emerald - proposal.emerald_offered + proposal.emerald_requested;

        accepter_resources.wood = accepter_resources.wood + proposal.wood_offered - proposal.wood_requested;
        accepter_resources.stone = accepter_resources.stone + proposal.stone_offered - proposal.stone_requested;
        accepter_resources.emerald = accepter_resources.emerald + proposal.emerald_offered - proposal.emerald_requested;

        event::emit(TradeAccepted {
            proposal_id: object::uid_to_inner(&proposal.id),
            proposer: proposal.proposer,
            accepter,
        });

        event::emit(ResourcesTraded {
            from: proposal.proposer,
            to: accepter,
            wood_given: proposal.wood_offered,
            stone_given: proposal.stone_offered,
            emerald_given: proposal.emerald_offered,
        });

        let TradeProposal { id, game_id: _, proposer: _, target: _, wood_offered: _, stone_offered: _, emerald_offered: _, wood_requested: _, stone_requested: _, emerald_requested: _ } = proposal;
        object::delete(id);
    }

    public entry fun cancel_trade(
        proposal: TradeProposal,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == proposal.proposer || sender == proposal.target, E_NOT_OWNER);

        event::emit(TradeCancelled {
            proposal_id: object::uid_to_inner(&proposal.id),
            cancelled_by: sender,
        });

        let TradeProposal { id, game_id: _, proposer: _, target: _, wood_offered: _, stone_offered: _, emerald_offered: _, wood_requested: _, stone_requested: _, emerald_requested: _ } = proposal;
        object::delete(id);
    }
}
