//! T2: Property-based tokenizer/FSM invariants.

use proptest::prelude::*;

proptest! {
    /// FSM classify must never panic on arbitrary UTF-8 input.
    #[test]
    fn classify_never_panics(input in "\\PC{0,500}") {
        let result = pragma_automata::fsm::classify(&input);
        let _ = result.intent;
        let _ = result.scores;
    }

    /// All scores are bounded.
    #[test]
    fn classify_scores_bounded(input in "\\PC{0,200}") {
        let result = pragma_automata::fsm::classify(&input);
        for (_, score) in &result.scores {
            prop_assert!(*score < 10000, "Unreasonably high score: {}", score);
        }
    }

    /// Empty or whitespace-only input always yields Idle.
    #[test]
    fn whitespace_only_is_idle(input in "\\s{0,50}") {
        let result = pragma_automata::fsm::classify(&input);
        prop_assert_eq!(
            format!("{:?}", result.intent),
            format!("{:?}", pragma_ipc::types::IntentType::Idle),
        );
    }
}
